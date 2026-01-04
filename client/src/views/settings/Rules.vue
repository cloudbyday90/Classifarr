<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <Card title="🎯 Classification Rules">
      <div class="space-y-4">
        <p class="text-gray-300">
          Classification rules are library-specific and configured within each library's settings.
          Rules allow you to create AI-powered conditions that automatically classify content into specific libraries.
        </p>

        <div class="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
          <div class="flex items-start gap-3">
            <span class="text-2xl">💡</span>
            <div class="flex-1">
              <h4 class="font-semibold text-blue-400 mb-1">How to Manage Rules</h4>
              <ol class="text-sm text-gray-300 list-decimal list-inside space-y-1">
                <li>Navigate to the <strong>Libraries</strong> page</li>
                <li>Select the library you want to configure</li>
                <li>Click the <strong>🧠 Smart Rule Builder</strong> button</li>
                <li>Create AI-powered rules using natural language</li>
              </ol>
            </div>
          </div>
        </div>

        <div class="flex gap-3 mt-6">
          <Button @click="$router.push('/libraries')" variant="primary">
            📚 Go to Libraries
          </Button>
        </div>
      </div>
    </Card>

    <Card title="📋 Rule Types">
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-gray-800/50 p-4 rounded-lg">
            <h4 class="font-medium text-gray-200 mb-2">🎬 Content-Based Rules</h4>
            <p class="text-sm text-gray-400">
              Filter content by genre, rating, year, cast, director, studio, and more.
            </p>
          </div>
          
          <div class="bg-gray-800/50 p-4 rounded-lg">
            <h4 class="font-medium text-gray-200 mb-2">🏢 Studio Rules</h4>
            <p class="text-sm text-gray-400">
              Route content from specific production studios to designated libraries.
            </p>
          </div>
          
          <div class="bg-gray-800/50 p-4 rounded-lg">
            <h4 class="font-medium text-gray-200 mb-2">🎭 Franchise Rules</h4>
            <p class="text-sm text-gray-400">
              Automatically classify content belonging to specific franchises or collections.
            </p>
          </div>
          
          <div class="bg-gray-800/50 p-4 rounded-lg">
            <h4 class="font-medium text-gray-200 mb-2">🔤 Keyword Rules</h4>
            <p class="text-sm text-gray-400">
              Match content based on title, plot keywords, or metadata tags.
            </p>
          </div>
        </div>
      </div>
    </Card>

    <Card title="⚡ Rule Priority">
      <div class="space-y-4">
        <p class="text-gray-300">
          When multiple rules match content, Classifarr uses the following priority order:
        </p>
        
        <div class="bg-gray-800/50 rounded-lg p-4">
          <ol class="list-decimal list-inside space-y-2 text-gray-300">
            <li>Custom library rules (configured in each library)</li>
            <li>Discovered patterns (based on your classification history)</li>
            <li>AI classification (when no rules or patterns match with high confidence)</li>
          </ol>
        </div>

        <div class="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 mt-4">
          <div class="flex items-start gap-3">
            <span class="text-xl">⚙️</span>
            <div class="flex-1">
              <p class="text-sm text-gray-300">
                You can adjust the priority between rules and patterns in the 
                <router-link to="/settings?tab=ai" class="text-blue-400 hover:underline">AI Settings</router-link>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup>
import Card from '@/components/common/Card.vue'
import Button from '@/components/common/Button.vue'
</script>
