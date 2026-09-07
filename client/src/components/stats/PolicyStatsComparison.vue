<!-- Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 -->
<template>
  <div class="comparison-section">
    <h3>7-Day Comparison</h3>
    <p
      :id="helpId"
      class="comparison-help"
    >
      Rate changes are percentage points. N/A means a value is unavailable.
    </p>
    <div
      class="comparison-scroll"
      role="region"
      aria-label="7-day comparison table"
      :aria-describedby="helpId"
      tabindex="0"
    >
      <table>
        <caption class="sr-only">
          Policy metrics for the last 7 days and previous 7 days
        </caption>
        <thead>
          <tr>
            <th scope="col">
              Metric
            </th>
            <th scope="col">
              Last 7 Days
            </th>
            <th scope="col">
              Previous 7 Days
            </th>
            <th scope="col">
              Change
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.id"
          >
            <th scope="row">
              {{ row.label }}
            </th>
            <td>{{ row.current }}</td>
            <td>{{ row.previous }}</td>
            <td>{{ row.change }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, useId } from 'vue'
import { buildPolicyComparisonRows } from '@/utils/policyStatsComparison'

const props = defineProps({ periods: { type: Array, default: () => [] } })
const helpId = useId()
const rows = computed(() => buildPolicyComparisonRows(props.periods))
</script>

<style scoped>
.comparison-section { margin-bottom: 32px; color: #1f2937; }
h3 { font-size: 18px; margin-bottom: 8px; }
.comparison-help { color: #4b5563; font-size: 14px; line-height: 1.6; margin-bottom: 16px; }
.comparison-scroll { max-width: 100%; overflow-x: auto; border: 1px solid #d1d5db; border-radius: 6px; }
.comparison-scroll:focus-visible { outline: 3px solid #1d4ed8; outline-offset: 2px; }
table { width: 100%; min-width: 480px; border-collapse: collapse; background: white; }
th, td { padding: 12px; border-bottom: 1px solid #d1d5db; text-align: left; vertical-align: top; }
thead { background: #f9fafb; }
th { font-weight: 600; }
tbody tr:last-child th, tbody tr:last-child td { border-bottom: 0; }
</style>
