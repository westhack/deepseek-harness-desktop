<template>
  <div class="dsh-layout">
    <!-- 顶部导航栏 -->
    <header class="dsh-header">
      <div class="header-inner">
        <div class="header-brand">
          <div class="brand-logo">
            <img :src="whaleIcon" alt="" />
          </div>
          <div class="brand-text">
            <span class="brand-title">{{ language.versionManager }}</span>
            <span class="brand-sub">{{ language.communityClient }}</span>
          </div>
        </div>

        <div class="header-actions">
          <n-tag v-if="updateAvailable" type="warning" size="small" round :bordered="false">
            {{ language.updateAvailable }}
          </n-tag>
          <n-dropdown
            trigger="click"
            :options="localeOptions"
            :value="snapshot.localePreference"
            size="small"
            @select="changeLocale"
          >
            <n-button quaternary size="small">
              <template #icon><n-icon><GlobeIcon /></n-icon></template>
              {{ localeLabel }}
            </n-button>
          </n-dropdown>
          <n-dropdown
            trigger="click"
            :options="registryOptions"
            :value="snapshot.registryPreference"
            size="small"
            @select="changeRegistry"
          >
            <n-button quaternary size="small" :title="language.registrySource">
              <template #icon><n-icon><RegistryIcon /></n-icon></template>
              {{ registryLabel }}
            </n-button>
          </n-dropdown>
          <n-button
            quaternary
            size="small"
            :aria-label="language.starOnGitHub"
            @click="openExternal(repositoryUrl)"
          >
            v{{ appUpdate.currentVersion }}
          </n-button>
          <n-button
            size="small"
            :type="appUpdate.status === 'available' ? 'primary' : 'default'"
            :loading="appUpdate.status === 'checking' || appUpdate.status === 'downloading'"
            :disabled="['checking', 'downloading', 'unsupported'].includes(appUpdate.status)"
            @click="performAppUpdate"
          >
            <template #icon>
              <n-icon>
                <DownloadIcon v-if="appUpdate.status === 'available'" />
                <RestartIcon v-else-if="appUpdate.status === 'downloaded'" />
                <RefreshIcon v-else />
              </n-icon>
            </template>
            {{ appUpdate.status === 'downloading' ? `${Math.round(appUpdate.percent ?? 0)}%` : appUpdateButtonText }}
          </n-button>
        </div>
      </div>
    </header>

    <!-- 主体内容 -->
    <main class="dsh-main">
      <!-- 当前版本面板 -->
      <section class="current-panel">
        <div class="current-left">
          <div class="current-icon">
            <img :src="whaleIcon" alt="" />
          </div>
          <div class="current-info">
            <div class="current-label">{{ language.currentlyUsing }}</div>
            <div class="current-version">
              <span class="version-number">{{ snapshot.selectedVersion ? `DSH ${snapshot.selectedVersion}` : language.dshNotInstalled }}</span>
              <n-tag v-if="snapshot.selectedVersion" size="small" type="info" :bordered="false" round>{{ language.current }}</n-tag>
              <n-tag v-if="currentInstalled?.source === 'bundled'" size="small" :bordered="false" round>{{ language.bundled }}</n-tag>
            </div>
            <div class="current-meta">
              <span class="runtime-badge" :class="`runtime-${snapshot.runtimeStatus}`">
                <i></i>{{ statusText }}
              </span>
              <span class="meta-node">Node {{ snapshot.nodeVersion ?? language.unknown }}</span>
            </div>
          </div>
        </div>
        <div class="current-right">
          <n-button
            v-if="running"
            secondary
            size="medium"
            :disabled="busyAction !== null"
            @click="perform('stop', language.stoppingDsh, () => api.stop())"
          >
            {{ language.stop }}
          </n-button>
          <n-button
            type="primary"
            size="medium"
            :disabled="busyAction !== null || !snapshot.selectedVersion"
            @click="perform('launch', running ? language.openingDsh : language.startingDsh, () => api.launch())"
          >
            <template #icon><n-icon><OpenIcon /></n-icon></template>
            {{ running ? language.openDsh : language.startDsh }}
          </n-button>
          <n-button
            v-if="canQuickUpdate"
            size="medium"
            :disabled="busyAction !== null"
            @click="quickUpdateHarness"
          >
            {{ language.quickUpdateAction(latestVersion ?? '') }}
          </n-button>
        </div>
      </section>

      <!-- 版本库 -->
      <section class="version-section">
        <!-- 工具栏 -->
        <div class="toolbar">
          <n-tabs v-model:value="filter" type="segment" size="small">
            <n-tab-pane name="all" :tab="`${language.allVersions} (${counts.all})`" />
            <n-tab-pane name="installed" :tab="`${language.installed} (${counts.installed})`" />
            <n-tab-pane name="available" :tab="`${language.available} (${counts.available})`" />
          </n-tabs>
          <n-input
            v-model:value="query"
            class="search-input"
            :placeholder="language.searchVersion"
            clearable
            size="small"
          >
            <template #prefix><n-icon><SearchIcon /></n-icon></template>
          </n-input>
          <n-checkbox v-model:checked="showPrerelease" class="prerelease-toggle">
            {{ language.showPrerelease }}
          </n-checkbox>
          <n-button
            quaternary
            size="small"
            :disabled="busyAction !== null"
            @click="perform('refresh', language.syncingVersions, () => api.refresh())"
          >
            <template #icon><n-icon><RefreshIcon /></n-icon></template>
          </n-button>
        </div>

        <!-- 版本网格 -->
        <div class="version-grid">
          <div
            v-for="item in visibleRows"
            :key="item.version"
            class="version-card"
            :class="{ 'is-current': snapshot.selectedVersion === item.version }"
          >
            <div class="card-header">
              <span class="card-version">{{ item.version }}</span>
              <n-tag v-if="snapshot.selectedVersion === item.version" size="tiny" type="info" :bordered="false" round>{{ language.current }}</n-tag>
              <n-tag v-if="item.installed" size="tiny" :bordered="false" round>{{ language.installed }}</n-tag>
              <n-tag v-if="snapshot.latestVersion === item.version" size="tiny" type="warning" :bordered="false" round>{{ language.latest }}</n-tag>
            </div>
            <div class="card-meta">
              <span>{{ formatDate(item.publishedAt) }}</span>
              <span>{{ language.officialNpmShort }}</span>
            </div>
            <div class="card-action">
              <n-button
                v-if="snapshot.selectedVersion === item.version"
                size="small"
                disabled
                block
              >
                <template #icon><n-icon><CheckIcon /></n-icon></template>
                {{ language.inUse }}
              </n-button>
              <n-button
                v-else-if="item.installed"
                size="small"
                secondary
                block
                :disabled="busyAction !== null"
                :loading="busyAction === `switch:${item.version}`"
                @click="perform(`switch:${item.version}`, language.switchingTo(item.version), () => api.select(item.version))"
              >
                {{ language.switch }}
              </n-button>
              <n-button
                v-else
                size="small"
                type="primary"
                ghost
                block
                :disabled="busyAction !== null"
                :loading="busyAction === `install:${item.version}`"
                @click="perform(`install:${item.version}`, language.installingVersion(item.version), () => api.install(item.version))"
              >
                <template #icon><n-icon><DownloadIcon /></n-icon></template>
                {{ busyAction === `install:${item.version}` && progress ? progressLabel : language.install }}
              </n-button>
            </div>
          </div>

          <div v-if="visibleRows.length === 0" class="empty-state">
            <n-empty :description="snapshot.availableVersions.length === 0 ? language.refreshEmpty : language.adjustFilters">
              <template #icon>
                <n-icon size="40"><SearchIcon /></n-icon>
              </template>
            </n-empty>
          </div>
        </div>
      </section>
    </main>

    <!-- 底部状态栏 -->
    <footer class="dsh-footer">
      <span :class="{ 'error-message': snapshot.error }">
        {{ localizeMessage(snapshot.locale, snapshot.error ?? message) }}
      </span>
    </footer>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, h } from 'vue';
import semver from 'semver';
import {
  NButton, NIcon, NTag, NInput, NCheckbox, NTabs, NTabPane, NEmpty, NDropdown, useMessage,
} from 'naive-ui';
import { useDshStore, init } from '@/store/dsh';
import { copy, localizeMessage } from '@/utils/i18n';
import whaleIcon from '@/assets/deepseek-whale.svg';

const repositoryUrl = 'https://github.com/westhack/deepseek-harness-desktop';

const dshStore = useDshStore();
const snapshot = computed(() => dshStore.snapshot);
const appUpdate = computed(() => dshStore.appUpdate);
const progress = computed(() => dshStore.progress);
const busyAction = computed(() => dshStore.busyAction);

// 暴露 dshDesktop API 给模板使用（Vue3 模板沙箱不允许直接访问 window）
const api = typeof window !== 'undefined' ? window.dshDesktop : undefined;

const filter = ref('all');
const query = ref('');
const showPrerelease = ref(true);

const language = computed(() => copy(snapshot.value.locale));

// ===== 内联 SVG 图标组件 =====
const SvgWrapper = (children) => () => h('svg', {
  viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'none',
  stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
}, children);

const CheckIcon = SvgWrapper([h('path', { d: 'm5 12 4 4L19 6' })]);
const DownloadIcon = SvgWrapper([h('path', { d: 'M12 3v12m0 0 4-4m-4 4-4-4M5 20h14' })]);
const SearchIcon = SvgWrapper([h('circle', { cx: '11', cy: '11', r: '6' }), h('path', { d: 'm16 16 4 4' })]);
const RefreshIcon = SvgWrapper([
  h('path', { d: 'M20 7v5h-5M4 17v-5h5' }),
  h('path', { d: 'M18.1 9A7 7 0 0 0 6 6.5L4 12m16 0-2 5.5A7 7 0 0 1 5.9 15' }),
]);
const RestartIcon = SvgWrapper([
  h('path', { d: 'M20 6v5h-5' }),
  h('path', { d: 'M18.2 9A7.5 7.5 0 1 0 19 15' }),
]);
const OpenIcon = SvgWrapper([
  h('path', { d: 'M14 4h6v6m0-6-9 9' }),
  h('path', { d: 'M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5' }),
]);
const GlobeIcon = SvgWrapper([
  h('circle', { cx: '12', cy: '12', r: '9' }),
  h('path', { d: 'M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18' }),
]);
const RegistryIcon = SvgWrapper([
  h('ellipse', { cx: '12', cy: '6', rx: '8', ry: '3' }),
  h('path', { d: 'M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6' }),
  h('path', { d: 'M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3' }),
]);

// ===== 派生数据 =====
const rows = computed(() => {
  const items = new Map();
  for (const item of snapshot.value.availableVersions) {
    items.set(item.version, { version: item.version, publishedAt: item.publishedAt, source: null, installed: false });
  }
  for (const item of snapshot.value.installedVersions) {
    const existing = items.get(item.version);
    items.set(item.version, {
      version: item.version,
      publishedAt: existing?.publishedAt ?? null,
      source: item.source,
      installed: true,
    });
  }
  return [...items.values()].sort((a, b) => semver.rcompare(a.version, b.version));
});

const counts = computed(() => ({
  all: rows.value.length,
  installed: rows.value.filter((i) => i.installed).length,
  available: rows.value.filter((i) => !i.installed).length,
}));

const visibleRows = computed(() => rows.value.filter((item) => {
  if (filter.value === 'installed' && !item.installed) return false;
  if (filter.value === 'available' && item.installed) return false;
  if (!showPrerelease.value && semver.prerelease(item.version)) return false;
  return item.version.toLowerCase().includes(query.value.trim().toLowerCase());
}));

const running = computed(() => ['running', 'starting'].includes(snapshot.value.runtimeStatus));
const currentInstalled = computed(() => snapshot.value.installedVersions.find((i) => i.version === snapshot.value.selectedVersion));
const updateAvailable = computed(() => Boolean(snapshot.value.latestVersion && snapshot.value.selectedVersion && semver.gt(snapshot.value.latestVersion, snapshot.value.selectedVersion)));
const latestVersion = computed(() => snapshot.value.latestVersion);
const canQuickSwitch = computed(() => Boolean(latestVersion.value && snapshot.value.installedVersions.some((i) => i.version === latestVersion.value)));
const canQuickInstall = computed(() => Boolean(latestVersion.value && snapshot.value.installedVersions.every((i) => i.version !== latestVersion.value)));
const canQuickUpdate = computed(() => Boolean(snapshot.value.latestVersion && snapshot.value.selectedVersion && semver.lt(snapshot.value.selectedVersion, snapshot.value.latestVersion) && (canQuickSwitch.value || canQuickInstall.value)));

const statusText = computed(() => ({
  idle: language.value.notRunning,
  starting: language.value.starting,
  running: language.value.dshRunning,
  stopping: language.value.stopping,
  failed: language.value.runtimeError,
}[snapshot.value.runtimeStatus]));

const appUpdateButtonText = computed(() => {
  const u = appUpdate.value;
  if (u.status === 'available') return u.delivery === 'manual' ? language.value.openDownloadPage : language.value.downloadUpdate;
  if (u.status === 'downloaded') return language.value.restartInstall;
  if (u.status === 'checking') return language.value.checking;
  if (u.status === 'up-to-date' || u.status === 'error') return language.value.checkAgain;
  if (u.status === 'unsupported') return language.value.releaseOnly;
  return language.value.checkUpdates;
});

// ===== 安装进度 =====
const progressLabel = computed(() => {
  if (!progress.value) return language.value.installing;
  return localizeMessage(snapshot.value.locale, progress.value.message);
});

// ===== 语言切换 =====
const message = useMessage();
const localeOptions = computed(() => [
  { label: language.value.followSystem, key: 'system' },
  { type: 'divider', key: 'd1' },
  { label: '简体中文', key: 'zh-CN' },
  { label: 'English', key: 'en-US' },
]);
const localeLabel = computed(() => {
  const pref = snapshot.value.localePreference;
  if (pref === 'system') return language.value.followSystem;
  if (pref === 'zh-CN') return '简体中文';
  return 'English';
});

// ===== 镜像源切换 =====
const registryOptions = computed(() => [
  { label: language.value.officialRegistry, key: 'official' },
  { label: language.value.npmmirrorRegistry, key: 'npmmirror' },
]);
const registryLabel = computed(() => {
  return snapshot.value.registryPreference === 'npmmirror'
    ? language.value.npmmirrorRegistry
    : language.value.officialRegistry;
});

// ===== 交互 =====
async function perform(key, label, action) {
  dshStore.busyAction = key;
  dshStore.message = label;
  try {
    await action();
    dshStore.message = language.value.completed;
    message?.success?.(language.value.completed);
  } catch (error) {
    const msg = localizeMessage(snapshot.value.locale, error instanceof Error ? error.message : language.value.failed);
    dshStore.message = msg;
    message?.error?.(msg, { duration: 5000 });
  } finally {
    dshStore.busyAction = null;
  }
}

async function quickUpdateHarness() {
  if (!latestVersion.value || !snapshot.value.selectedVersion || !semver.lt(snapshot.value.selectedVersion, latestVersion.value)) return;
  const isLatestInstalled = snapshot.value.installedVersions.some((i) => i.version === latestVersion.value);
  const action = isLatestInstalled
    ? () => api.select(latestVersion.value)
    : () => api.install(latestVersion.value);
  const busyLabel = isLatestInstalled ? language.value.quickSwitching(latestVersion.value) : language.value.quickInstalling(latestVersion.value);
  await perform(`quick-update-${latestVersion.value}`, busyLabel, action);
}

async function performAppUpdate() {
  const u = appUpdate.value;
  if (u.status === 'downloaded') {
    await api.installAppUpdate();
    return;
  }
  try {
    const result = u.status === 'available'
      ? await api.downloadAppUpdate()
      : await api.checkAppUpdate();
    Object.assign(dshStore.state.appUpdate, result);
  } catch (error) {
    dshStore.state.appUpdate.status = 'error';
    dshStore.state.appUpdate.message = localizeMessage(snapshot.value.locale, error instanceof Error ? error.message : language.value.appUpdateFailed);
  }
}

async function changeLocale(preference) {
  if (!preference || preference === snapshot.value.localePreference) return;
  try {
    const next = await api.setLocale(preference);
    Object.assign(dshStore.state.snapshot, next);
    document.documentElement.lang = next.locale;
    dshStore.message = copy(next.locale).ready;
    message?.success?.(copy(next.locale).localeChanged);
  } catch (error) {
    const msg = localizeMessage(snapshot.value.locale, error instanceof Error ? error.message : language.value.localeChangeFailed);
    dshStore.message = msg;
    message?.error?.(msg);
  }
}

async function changeRegistry(preference) {
  if (!preference || preference === snapshot.value.registryPreference) return;
  try {
    const next = await api.setRegistry(preference);
    Object.assign(dshStore.state.snapshot, next);
    dshStore.message = language.value.registryChanged;
    message?.success?.(language.value.registryChanged);
  } catch (error) {
    const msg = localizeMessage(snapshot.value.locale, error instanceof Error ? error.message : language.value.registryChangeFailed);
    dshStore.message = msg;
    message?.error?.(msg);
  }
}

function openExternal(url) {
  void api.openExternal(url);
}

function formatDate(value) {
  if (!value) return language.value.unknownPublishDate;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return language.value.unknownPublishDate;
  return new Intl.DateTimeFormat(snapshot.value.locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

onMounted(() => {
  void init();
});
</script>

<style lang="less" scoped>
.dsh-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 50%, #f5f0ff 100%);
}

/* ===== 顶部导航栏 ===== */
.dsh-header {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(99, 102, 241, 0.08);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  margin: 0 auto;
  padding: 14px 24px;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-logo {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #6366f1, #818cf8);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);

  img {
    width: 26px;
    height: 26px;
    filter: brightness(0) invert(1);
  }
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.brand-title {
  font-size: 16px;
  font-weight: 700;
  color: #1e1b4b;
  letter-spacing: -0.02em;
}

.brand-sub {
  font-size: 11px;
  color: #6b7280;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ===== 主体内容 ===== */
.dsh-main {
  flex: 1;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ===== 当前版本面板 ===== */
.current-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 24px;
  border-radius: 16px;
  background: linear-gradient(135deg, #ffffff 0%, #f8faff 100%);
  border: 1px solid rgba(99, 102, 241, 0.1);
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.06);
}

.current-left {
  display: flex;
  align-items: center;
  gap: 18px;
}

.current-icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: linear-gradient(135deg, #eef2ff, #e0e7ff);
  flex-shrink: 0;

  img {
    width: 34px;
    height: 34px;
    filter: invert(45%) sepia(60%) saturate(2476%) hue-rotate(224deg) brightness(96%) contrast(94%);
  }
}

.current-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.current-label {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.current-version {
  display: flex;
  align-items: center;
  gap: 8px;
}

.version-number {
  font-size: 22px;
  font-weight: 700;
  color: #1e1b4b;
  letter-spacing: -0.03em;
}

.current-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}

.runtime-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: #f3f4f6;
  color: #6b7280;

  i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #9ca3af;
  }
}

.runtime-running {
  background: #ecfdf5;
  color: #047857;
  i {
    background: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
  }
}

.runtime-starting, .runtime-stopping {
  color: #d97706;
  background: #fffbeb;
  i {
    background: #f59e0b;
    animation: pulse 1.2s infinite;
  }
}

.runtime-failed {
  background: #fef2f2;
  color: #dc2626;
  i { background: #ef4444; }
}

.meta-node {
  font-size: 11px;
  color: #9ca3af;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.current-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* ===== 版本库 ===== */
.version-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.search-input {
  min-width: 200px;
  flex: 1;
  max-width: 320px;
}

.prerelease-toggle {
  font-size: 12px;
  color: #6b7280;
}

/* ===== 版本网格 ===== */
.version-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
  min-height: 200px;
}

.version-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  transition: all 0.15s ease;

  &:hover {
    border-color: #c7d2fe;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.08);
    transform: translateY(-1px);
  }

  &.is-current {
    border-color: #818cf8;
    background: linear-gradient(135deg, #fff, #f5f3ff);
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.12);
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.card-version {
  font-size: 15px;
  font-weight: 700;
  color: #1f2937;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: -0.02em;
}

.card-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #9ca3af;
}

.card-action {
  margin-top: auto;
}

.empty-state {
  grid-column: 1 / -1;
  display: grid;
  place-items: center;
  padding: 60px 20px;
}

/* ===== 底部状态栏 ===== */
.dsh-footer {
  border-top: 1px solid rgba(99, 102, 241, 0.08);
  background: rgba(255, 255, 255, 0.6);
  padding: 10px 24px;
  text-align: center;

  span {
    font-size: 11px;
    color: #6b7280;
  }
}

.error-message {
  color: #dc2626 !important;
}

@keyframes pulse {
  50% { opacity: 0.35; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .current-panel {
    flex-direction: column;
    align-items: flex-start;
  }

  .current-right {
    width: 100%;
    justify-content: flex-end;
  }

  .version-grid {
    grid-template-columns: 1fr;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-input {
    max-width: none;
  }
}
</style>
