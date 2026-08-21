<template>
  <n-config-provider
    :theme="currentTheme"
    :theme-overrides="themeOverrides"
    :locale="naiveLocale"
    :date-locale="naiveDateLocale"
  >
    <n-message-provider>
      <n-dialog-provider>
        <router-view />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
<script setup>
import { computed, onMounted, watch } from 'vue';
import { NConfigProvider, NMessageProvider, NDialogProvider, zhCN, dateZhCN, enUS, dateEnUS, darkTheme } from 'naive-ui';
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

/**
 * 判断当前是否为深色主题
 */
function isDark(preference) {
  if (preference === 'dark') return true;
  if (preference === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

const currentTheme = computed(() => {
  const pref = dshStore.snapshot.themePreference || 'system';
  return isDark(pref) ? darkTheme : null;
});

/**
 * 应用主题 class 到 <html>
 */
function applyThemeClass(preference) {
  const dark = isDark(preference);
  document.documentElement.classList.toggle('dark-theme', dark);
  document.documentElement.classList.toggle('light-theme', !dark);
}

// 监听主题变化
watch(() => dshStore.snapshot.themePreference, (pref) => {
  applyThemeClass(pref || 'system');
}, { immediate: true });

onMounted(() => {
  const loadingElement = document.getElementById('loadingPage');
  if (loadingElement) loadingElement.remove();

  // 初始应用主题
  applyThemeClass(dshStore.snapshot.themePreference || 'system');

  // 监听系统主题变化
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    if (dshStore.snapshot.themePreference === 'system') {
      applyThemeClass('system');
    }
  });
});
</script>