# Classifarr Design System

## Color Palette

### Primary Colors
| Name | Hex | Tailwind | Usage |
|------|-----|----------|-------|
| Primary | `#3b82f6` | `primary` | Buttons, links, active states |
| Primary Dark | `#2563eb` | `primary-dark` | Hover states |
| Primary Light | `#60a5fa` | `primary-light` | Highlights, accents |

### Background Colors
| Name | Hex | Tailwind | Usage |
|------|-----|----------|-------|
| Background | `#1a1d24` | `background` | Main page background |
| Background Light | `#242731` | `background-light` | Cards, elevated surfaces |
| Sidebar | `#12141a` | `sidebar` | Navigation sidebar |

### Semantic Colors
| Name | Hex | Tailwind | Usage |
|------|-----|----------|-------|
| Success | `#22c55e` | `success` | Positive actions, confirmations |
| Warning | `#f59e0b` | `warning` | Caution states, pending |
| Error | `#ef4444` | `error` | Errors, destructive actions |

### Text Colors
| Usage | Tailwind Class |
|-------|----------------|
| Primary text | `text-white` or `text-gray-100` |
| Secondary text | `text-gray-400` |
| Muted text | `text-gray-500` |
| Disabled text | `text-gray-600` |

### Border Colors
| Usage | Tailwind Class |
|-------|----------------|
| Card borders | `border-gray-800` |
| Input borders | `border-gray-700` |
| Dividers | `border-gray-700` |
| Focus ring | `border-primary` |

## Typography

- **Font Family**: System font stack (default Tailwind)
- **Headings**: `font-bold` or `font-semibold`
- **Body**: `font-medium` or default weight
- **Small text**: `text-sm` with `text-gray-400`

### Heading Sizes
```
h1: text-2xl font-bold
h2: text-xl font-semibold  
h3: text-lg font-semibold
h4: text-base font-medium
```

## Components

### Button
```vue
<Button variant="primary" size="md" icon="✨" :loading="false" @click="handleClick">
  Click Me
</Button>
```

### Input
```vue
<Input v-model="value" label="Label" placeholder="Placeholder" :error="errorMessage" />
```

### PasswordInput
```vue
<PasswordInput v-model="password" label="Password" hint="Must be 8+ characters" />
```

### Select
```vue
<Select v-model="selected" label="Choose option" :options="[{value: '1', label: 'Option 1'}]" />
```

### MultiSelect
```vue
<MultiSelect v-model="selectedArray" label="Tags" :options="tagOptions" />
```

### Toggle
```vue
<Toggle v-model="enabled" label="Enable feature" />
```

### Slider
```vue
<Slider v-model="value" :min="0" :max="100" :step="1" label="Temperature" unit="°" />
```

### Card
```vue
<Card title="Card Title" description="Optional description">
  Card content here
</Card>
```

### Table
```vue
<Table 
  :columns="[{key: 'name', label: 'Name', sortable: true}]" 
  :data="items"
  :pagination="true"
  :current-page="1"
  :total-items="100"
>
  <template #cell-name="{ value }">
    {{ value }}
  </template>
  <template #actions="{ row }">
    <Button size="sm">Edit</Button>
  </template>
</Table>
```

### Tabs
```vue
<Tabs v-model="activeTab" :tabs="[{id: 'tab1', label: 'Tab 1', icon: '📊'}]">
  <template #tab1>Tab 1 content</template>
</Tabs>
```

### ConnectionStatus
```vue
<ConnectionStatus 
  :status="'idle'|'testing'|'success'|'error'" 
  service-name="Radarr"
  :details="{ serverName: 'Radarr', version: '5.0.0' }"
  :error="{ message: 'Connection refused', troubleshooting: ['Check URL'] }"
/>
```

### Toast (via composable)
```javascript
import { useToast } from '@/stores/toast'

const toast = useToast()
toast.success('Settings saved!')
toast.error('Failed to connect')
toast.warning('API key expiring soon')
toast.info('New version available')
```

## Layout Patterns

### Page Layout
```vue
<div class="space-y-6">
  <h1 class="text-2xl font-bold">Page Title</h1>
  <Card title="Section">
    Content here
  </Card>
</div>
```

### Form Layout
```vue
<div class="space-y-4">
  <Input label="Field 1" />
  <Input label="Field 2" />
  <div class="flex gap-4">
    <Button variant="secondary">Cancel</Button>
    <Button variant="primary">Save</Button>
  </div>
</div>
```

### Settings Page Pattern
```vue
<Card title="Section Name" description="Section description">
  <div class="space-y-4">
    <!-- Form fields -->
  </div>
  <div class="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-700">
    <Button @click="test" variant="secondary">Test Connection</Button>
    <Button @click="save" variant="primary">Save</Button>
  </div>
  <ConnectionStatus :status="connectionStatus" />
</Card>
```

## Spacing Scale

Use Tailwind's default spacing scale:
- `gap-2` / `space-y-2`: Tight spacing (8px)
- `gap-4` / `space-y-4`: Standard spacing (16px)
- `gap-6` / `space-y-6`: Section spacing (24px)
- `p-4`: Standard padding
- `p-6`: Card padding

## Accessibility

- All interactive elements must be keyboard accessible
- Use `aria-label` for icon-only buttons
- Maintain 4.5:1 contrast ratio for text
- Use `role="switch"` for toggles
- Include focus styles (`:focus:ring-2 ring-primary`)

## Animations

- Use `transition-colors` for color changes
- Use `transition-all` for multi-property changes
- Duration: 150-300ms for UI feedback
- Use `animate-spin` for loading spinners
- Use `animate-pulse` for skeleton loading
