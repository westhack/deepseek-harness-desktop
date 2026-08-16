<template>
  <n-config-provider :theme-overrides="themeOverrides" :locale="naiveLocale" :date-locale="naiveDateLocale">
    <n-message-provider>
      <n-dialog-provider>
        <router-view />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
<script setup>
import { computed, onMounted } from 'vue';
import { NConfigProvider, NMessageProvider, NDialogProvider, zhCN, dateZhCN, enUS, dateEnUS } from 'naive-ui';
import { useDshStore } from './store/dsh';

const dshStore = useDshStore();

const themeOverrides = {
  common: {
    primaryColor: '#6366f1',
    primaryColorHover: '#818cf8',
    primaryColorPressed: '#4f46e5',
    borderRadius: '8px',
    fontSize: '13px',
  },
  Button: {
    fontWeight: '600',
  },
};

const isZh = computed(() => dshStore.snapshot.locale === 'zh-CN');
const naiveLocale = computed(() => (isZh.value ? zhCN : enUS));
const naiveDateLocale = computed(() => (isZh.value ? dateZhCN : dateEnUS));

onMounted(() => {
  const loadingElement = document.getElementById('loadingPage');
  if (loadingElement) loadingElement.remove();
});
</script>
