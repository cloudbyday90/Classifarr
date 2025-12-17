<template>
  <div class="setup-wizard">
    <div class="wizard-container">
      <div class="wizard-header">
        <h1>Welcome to Classifarr!</h1>
        <p>Let's get you set up in a few simple steps</p>
      </div>
      
      <div class="wizard-progress">
        <div
          v-for="(step, index) in steps"
          :key="index"
          class="progress-step"
          :class="{ active: currentStep === index, completed: currentStep > index }"
        >
          <div class="step-number">{{ index + 1 }}</div>
          <div class="step-label">{{ step.title }}</div>
        </div>
      </div>
      
      <div class="wizard-content">
        <component :is="currentStepComponent" @next="nextStep" @skip="nextStep" />
      </div>
    </div>
  </div>
</template>

<script>
import TMDB from './settings/TMDB.vue'
import Ollama from './settings/Ollama.vue'
import Discord from './settings/Discord.vue'

export default {
  name: 'SetupWizard',
  data() {
    return {
      currentStep: 0,
      steps: [
        { title: 'TMDB', component: 'TMDB', required: true },
        { title: 'AI (Ollama)', component: 'Ollama', required: false },
        { title: 'Discord', component: 'Discord', required: false }
      ]
    }
  },
  computed: {
    currentStepComponent() {
      return this.steps[this.currentStep].component
    }
  },
  methods: {
    nextStep() {
      if (this.currentStep < this.steps.length - 1) {
        this.currentStep++
      } else {
        // Setup complete
        this.$router.push('/')
      }
    }
  },
  components: {
    TMDB,
    Ollama,
    Discord
  }
}
</script>

<style scoped>
.setup-wizard {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.wizard-container {
  max-width: 800px;
  width: 100%;
}

.wizard-header {
  text-align: center;
  margin-bottom: 2rem;
}

.wizard-header h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.wizard-header p {
  color: #94a3b8;
}

.wizard-progress {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 2rem;
}

.progress-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.progress-step.active,
.progress-step.completed {
  opacity: 1;
}

.step-number {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #334155;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.progress-step.active .step-number {
  background: #3b82f6;
}

.progress-step.completed .step-number {
  background: #22c55e;
}

.step-label {
  font-size: 0.875rem;
  color: #cbd5e1;
}

.wizard-content {
  background: #1e293b;
  border-radius: 0.5rem;
  padding: 2rem;
  border: 1px solid #334155;
}
</style>
