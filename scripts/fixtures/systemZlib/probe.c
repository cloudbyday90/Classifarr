/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
#include <assert.h>
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <zlib.h>

static const unsigned char payload[] = "Classifarr bounded native compression control";

static size_t encode(z_stream *stream, unsigned char *output, size_t capacity) {
    stream->next_in = (Bytef *)payload;
    stream->avail_in = sizeof(payload);
    stream->next_out = output;
    stream->avail_out = (uInt)capacity;
    assert(deflate(stream, Z_FINISH) == Z_STREAM_END);
    return capacity - stream->avail_out;
}

static void decode(const unsigned char *input, size_t length, int bits) {
    unsigned char output[256] = {0};
    z_stream stream = {0};
    assert(inflateInit2(&stream, bits) == Z_OK);
    stream.next_in = (Bytef *)input;
    stream.avail_in = (uInt)length;
    stream.next_out = output;
    stream.avail_out = sizeof(output);
    assert(inflate(&stream, Z_FINISH) == Z_STREAM_END);
    assert(stream.total_out == sizeof(payload));
    assert(memcmp(output, payload, sizeof(payload)) == 0);
    assert(inflateEnd(&stream) == Z_OK);
}

static int header_reset(void) {
    unsigned char first[512], second[512], third[512];
    z_stream stream = {0};
    gz_header header = {0};
    header.name = (Bytef *)"owned-header";
    assert(deflateInit2(&stream, 6, Z_DEFLATED, 31, 8, Z_DEFAULT_STRATEGY) == Z_OK);
    assert(deflateSetHeader(&stream, &header) == Z_OK);
    size_t one = encode(&stream, first, sizeof(first));
    assert((first[3] & 8) != 0);
    assert(deflateReset(&stream) == Z_OK);
    size_t two = encode(&stream, second, sizeof(second));
    int cleared = (second[3] & 8) == 0;
    assert(deflateReset(&stream) == Z_OK);
    assert(deflateSetHeader(&stream, &header) == Z_OK);
    size_t three = encode(&stream, third, sizeof(third));
    assert((third[3] & 8) != 0);
    assert(deflateEnd(&stream) == Z_OK);
    decode(first, one, 31); decode(second, two, 31); decode(third, three, 31);
    z_stream truncated = {0}; unsigned char output[256];
    assert(inflateInit2(&truncated, 31) == Z_OK);
    truncated.next_in = first; truncated.avail_in = (uInt)one - 4;
    truncated.next_out = output; truncated.avail_out = sizeof(output);
    assert(inflate(&truncated, Z_FINISH) != Z_STREAM_END);
    assert(truncated.total_out <= sizeof(payload));
    assert(inflateEnd(&truncated) == Z_OK);
    return cleared;
}

static int exact_boundary(void) {
    unsigned char compressed[512], output[sizeof(payload)];
    z_stream compressor = {0}, decoder = {0};
    assert(deflateInit2(&compressor, 6, Z_DEFLATED, -15, 8, Z_DEFAULT_STRATEGY) == Z_OK);
    size_t length = encode(&compressor, compressed, sizeof(compressed));
    assert(deflateEnd(&compressor) == Z_OK);
    assert(inflateInit2(&decoder, -15) == Z_OK);
    decoder.next_in = compressed; decoder.avail_in = (uInt)length;
    decoder.next_out = output; decoder.avail_out = sizeof(output);
    int result = inflate(&decoder, Z_NO_FLUSH);
    assert(result == Z_OK || result == Z_STREAM_END);
    assert(decoder.total_out == sizeof(payload));
    assert(memcmp(output, payload, sizeof(payload)) == 0);
    assert(inflateEnd(&decoder) == Z_OK);
    return result == Z_STREAM_END;
}

static void seek_control(void) {
    char path[] = "/tmp/classifarr-zlib-native-XXXXXX";
    int fd = mkstemp(path); assert(fd >= 0); assert(close(fd) == 0);
    gzFile file = gzopen(path, "wb"); assert(file != NULL);
    assert(gzwrite(file, "A", 1) == 1);
    assert(gzseek(file, 128, SEEK_SET) == 128);
    assert(gzwrite(file, "B", 1) == 1); assert(gztell(file) == 129);
    assert(gzclose(file) == Z_OK);
    unsigned char output[129]; file = gzopen(path, "rb"); assert(file != NULL);
    assert(gzread(file, output, sizeof(output)) == (int)sizeof(output));
    assert(output[0] == 'A' && output[128] == 'B');
    for (size_t i = 1; i < 128; i++) assert(output[i] == 0);
    assert(gzseek(file, 128, SEEK_SET) == 128); assert(gzgetc(file) == 'B');
    assert(gzclose(file) == Z_OK); assert(unlink(path) == 0);
}

int main(int argc, char **argv) {
    assert(argc == 1 || (argc == 2 && strcmp(argv[1], "--observe") == 0));
    Dl_info info;
    assert(dladdr((void *)zlibVersion, &info) != 0);
    assert(strstr(info.dli_fname, "libz.so.1") != NULL);
    assert(sizeof(z_off_t) == 8);
    int cleared = header_reset(), exact = exact_boundary();
    seek_control();
    if (argc == 1) { assert(strcmp(zlibVersion(), "1.4") == 0); assert(cleared); assert(exact); }
    printf("{\"version\":\"%s\",\"dynamicLibrary\":true,\"offsetBytes\":%zu,"
           "\"resetClearsHeader\":%s,\"exactBoundaryEnds\":%s,\"roundtrip\":true,\"truncation\":true,\"seek\":true}\n",
           zlibVersion(), sizeof(z_off_t), cleared ? "true" : "false", exact ? "true" : "false");
    return 0;
}
