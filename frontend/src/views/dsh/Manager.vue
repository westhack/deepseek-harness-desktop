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
            <span class="brand-title">{{ pageTitle }}</span>
            <span class="brand-sub">{{ pageTitleSub }}</span>
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
          <n-dropdown
            trigger="click"
            :options="themeOptions"
            :value="snapshot.themePreference || 'system'"
            size="small"
            @select="changeTheme"
          >
            <n-button quaternary size="small" :title="language.themeLabel">
              <template #icon>
                <n-icon><MoonIcon v-if="isDarkTheme" /><SunIcon v-else /></n-icon>
              </template>
              {{ themeLabel }}
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
      <!-- 视图切换 -->
      <div class="view-tabs">
        <n-tabs v-model:value="view" type="segment" size="small">
          <n-tab-pane name="manager">
            <template #tab>{{ language.versionManager }}</template>
          </n-tab-pane>
          <n-tab-pane name="plugins">
            <template #tab>{{ language.pluginMarket }}</template>
          </n-tab-pane>
        </n-tabs>
      </div>

      <!-- 版本管理视图 -->
      <template v-if="view === 'manager'">
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
            <n-tab-pane name="all">
              <template #tab>{{ `${language.allVersions} (${counts.all})` }}</template>
            </n-tab-pane>
            <n-tab-pane name="installed">
              <template #tab>{{ `${language.installed} (${counts.installed})` }}</template>
            </n-tab-pane>
            <n-tab-pane name="available">
              <template #tab>{{ `${language.available} (${counts.available})` }}</template>
            </n-tab-pane>
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
              <n-button
                v-if="item.installed && item.source !== 'bundled' && snapshot.selectedVersion !== item.version"
                class="card-uninstall"
                size="tiny"
                quaternary
                type="error"
                :disabled="busyAction !== null"
                :loading="busyAction === `uninstall:${item.version}`"
                :title="language.uninstall"
                @click="confirmUninstallVersion(item.version)"
              >
                <template #icon><n-icon><TrashIcon /></n-icon></template>
                {{ language.uninstall }}
              </n-button>
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
              <template v-else-if="item.installed">
                <n-button
                  size="small"
                  secondary
                  block
                  :disabled="busyAction !== null"
                  :loading="busyAction === `switch:${item.version}`"
                  @click="perform(`switch:${item.version}`, language.switchingTo(item.version), () => api.select(item.version))"
                >
                  {{ language.switch }}
                </n-button>
              </template>
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
                <span
                  v-if="busyAction === `install:${item.version}` && progress"
                  class="install-progress-label"
                  :title="installProgressLabel"
                >
                  {{ installProgressLabel }}
                </span>
                <span v-else>{{ language.install }}</span>
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
      </template>

      <!-- 插件市场视图 -->
      <template v-else>
        <section class="plugin-panel">
          <!-- 检测到剪贴板命令时的引导条 -->
          <div v-if="detectedCommand && pluginSubView === 'discover'" class="plugin-detect-banner">
            <div class="detect-text">
              <div class="detect-title">{{ language.pluginDetectedTitle }}</div>
              <code class="detect-command">{{ detectedCommand }}</code>
            </div>
            <div class="detect-actions">
              <n-button size="small" type="primary" :loading="pluginBusy" :disabled="pluginBusy" @click="installDetectedPlugin">
                {{ language.pluginDetectedAction }}
              </n-button>
              <n-button size="small" quaternary :disabled="pluginBusy" @click="dismissDetected">
                {{ language.pluginDetectedDismiss }}
              </n-button>
            </div>
          </div>

          <!-- 子标签：发现 / 主题 / 已安装 / 备份与恢复 / 诊断 -->
          <div class="plugin-subtabs">
            <n-tabs v-model:value="pluginSubView" type="segment" size="small">
              <n-tab-pane name="discover">
                <template #tab>{{ language.pluginTabDiscover }}</template>
              </n-tab-pane>
              <n-tab-pane name="themes">
                <template #tab>{{ language.pluginTabThemes }}</template>
              </n-tab-pane>
              <n-tab-pane name="installed">
                <template #tab>{{ language.pluginTabInstalled }} ({{ installedList.length }})</template>
              </n-tab-pane>
              <n-tab-pane name="backup">
                <template #tab>{{ language.pluginTabBackup }}</template>
              </n-tab-pane>
              <n-tab-pane name="diagnostic">
                <template #tab>{{ language.pluginTabDiagnostic }}</template>
              </n-tab-pane>
            </n-tabs>
          </div>

          <!-- 发现 / 主题 -->
          <template v-if="pluginSubView === 'discover' || pluginSubView === 'themes'">
            <div class="market-toolbar">
              <div class="market-source">
                <span class="source-label">{{ language.pluginSourceLabel }}</span>
                <n-select
                  v-model:value="selectedSourceId"
                  :options="sourceSelectOptions"
                  size="small"
                  :disabled="pluginLoading"
                  class="source-select"
                  @update:value="onSourceChange"
                />
                <n-button size="small" quaternary :disabled="pluginLoading" @click="showSourceModal = true">
                  <template #icon><n-icon><SettingsIcon /></n-icon></template>
                  {{ language.pluginSourceManage }}
                </n-button>
              </div>
              <n-button size="small" quaternary @click="openExternal(selectedSourceWebsite)" :disabled="!selectedSourceWebsite">
                <template #icon><n-icon><OpenIcon /></n-icon></template>
                {{ language.pluginMarketOpen }}
              </n-button>
            </div>

            <div class="market-meta" v-if="pluginMarket">
              <span class="meta-item">
                <n-tag size="small" round :bordered="false" type="info">{{ pluginMarket.name || 'Unknown' }}</n-tag>
              </span>
              <span class="meta-item" v-if="pluginMarket.count != null">
                {{ pluginMarket.count }} {{ language.pluginMetaCount }}
              </span>
              <span class="meta-item" v-if="pluginMarket.updated">
                {{ language.pluginMetaUpdated }} {{ pluginMarket.updated }}
              </span>
            </div>

            <div class="market-search-row">
              <n-input
                v-model:value="pluginSearch"
                size="small"
                :placeholder="language.pluginSearchPlaceholder"
                clearable
                class="market-search"
              >
                <template #prefix><n-icon><SearchIcon /></n-icon></template>
              </n-input>
              <n-select
                v-model:value="pluginSort"
                :options="pluginSortOptions"
                size="small"
                class="market-sort"
                :disabled="pluginLoading"
              />
            </div>

            <div class="category-row">
              <button
                v-for="chip in visibleCategoryChips"
                :key="chip.value"
                type="button"
                :class="['cat-chip', { active: pluginCategory === chip.value }]"
                @click="pluginCategory = chip.value"
              >
                {{ chip.label }}
              </button>
              <n-dropdown
                v-if="overflowCategoryChips.length > 0"
                trigger="click"
                :options="overflowCategoryOptions"
                @select="handleOverflowCategory"
              >
                <button type="button" class="cat-chip cat-chip-more">
                  {{ language.pluginCategoryAll }} ▽
                </button>
              </n-dropdown>
            </div>

            <div class="market-list">
              <n-spin :show="pluginLoading">
                <div v-if="!pluginLoading && filteredPlugins.length === 0" class="market-empty">
                  <n-empty :description="pluginMarket ? language.pluginLoadEmpty : language.pluginLoadFailed">
                    <template #icon>
                      <n-icon size="40"><SearchIcon /></n-icon>
                    </template>
                  </n-empty>
                </div>
                <n-virtual-list
                  v-else
                  :items="pluginItems"
                  :item-size="200"
                  item-resizable
                  key-field="key"
                  class="market-virtual"
                >
                  <template #default="{ item: row }">
                    <div class="plugin-row">
                      <div
                        v-for="plugin in row.plugins"
                        :key="pluginKey(plugin)"
                        class="plugin-card"
                      >
                        <div class="plugin-icon">
                          <img v-if="pluginIcon(plugin)" :src="pluginIcon(plugin)" :alt="plugin.name" @error="onIconError(plugin)" />
                          <span v-else :style="{ background: pluginColor(plugin) }">{{ pluginInitial(plugin) }}</span>
                        </div>
                        <div class="plugin-body">
                          <div class="plugin-head">
                            <span class="plugin-name" :title="plugin.name">{{ plugin.name }}</span>
                            <n-tag v-if="pluginSourceTag(plugin)" size="tiny" round :bordered="false" type="info">
                              {{ pluginSourceTag(plugin) }}
                            </n-tag>
                          </div>
                          <div class="plugin-sub">
                            <span v-if="plugin.owner" class="sub-owner">@{{ plugin.owner }}</span>
                            <span v-if="plugin.stars != null" class="sub-stars" :title="`${plugin.stars} ${language.pluginStars}`">
                              <n-icon size="12"><StarIcon /></n-icon>
                              {{ formatStars(plugin.stars) }}
                            </span>
                            <span v-if="pluginPublishedAt(plugin)" class="sub-date">
                              {{ language.pluginPublishedAt }} {{ pluginPublishedAt(plugin) }}
                            </span>
                          </div>
                          <div class="plugin-desc">{{ pluginDescription(plugin) }}</div>
                          <div class="plugin-foot">
                            <n-tag v-if="pluginCategoryLabel(plugin)" size="tiny" round :bordered="false" type="success">
                              {{ pluginCategoryLabel(plugin) }}
                            </n-tag>
                            <n-tag v-for="tag in pluginExtraTags(plugin)" :key="tag" size="tiny" round :bordered="false">
                              {{ tag }}
                            </n-tag>
                            <div class="plugin-actions">
                              <n-button
                                v-if="pluginPageUrl(plugin)"
                                size="tiny"
                                quaternary
                                @click="openPluginPage(plugin)"
                              >
                                <template #icon><n-icon><OpenIcon /></n-icon></template>
                                {{ language.pluginOpenPage }}
                              </n-button>
                              <n-button size="tiny" quaternary @click="copyInstall(plugin)">
                                <template #icon><n-icon><ClipboardIcon /></n-icon></template>
                                {{ language.pluginCopyCmd }}
                              </n-button>
                              <n-button
                                size="tiny"
                                type="primary"
                                :loading="pluginBusy"
                                :disabled="pluginBusy || !plugin.install"
                                @click="installFromCard(plugin)"
                              >
                                <template #icon><n-icon><DownloadIcon /></n-icon></template>
                                {{ language.pluginInstall }}
                              </n-button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </template>
                </n-virtual-list>
              </n-spin>
            </div>
          </template>

          <!-- 已安装 -->
          <template v-else-if="pluginSubView === 'installed'">
            <div class="installed-toolbar">
              <div class="installed-meta">
                <span class="meta-label">{{ language.pluginInstalledProfile }}:</span>
                <code class="meta-value">{{ installedProfile || '—' }}</code>
                <span v-if="installedList.length > 0" class="meta-count">
                  {{ language.pluginInstalledCount(installedList.length) }}
                </span>
              </div>
              <div class="installed-actions">
                <n-button
                  size="small"
                  type="warning"
                  :loading="pluginBusy"
                  :disabled="pluginBusy || !hasSelectedVersion || installedList.length === 0"
                  @click="updateAllInstalled"
                >
                  <template #icon><n-icon><RefreshIcon /></n-icon></template>
                  {{ language.pluginUpdateAll }}
                </n-button>
                <n-button
                  size="small"
                  type="primary"
                  :loading="pluginBusy"
                  :disabled="pluginBusy || !hasSelectedVersion"
                  @click="refreshInstalled"
                >
                  <template #icon><n-icon><RefreshIcon /></n-icon></template>
                  {{ language.pluginInstalledRefresh }}
                </n-button>
              </div>
            </div>
            <div class="installed-hint" v-if="!hasSelectedVersion">{{ language.pluginNoVersion }}</div>
            <div class="installed-hint" v-else-if="!installedProfile">{{ language.pluginInstalledNoProfile }}</div>
            <div class="installed-hint" v-else>{{ language.pluginInstalledHint }}</div>

            <div class="installed-list">
              <n-spin :show="pluginBusy && installedList.length === 0">
                <div v-if="!pluginBusy && installedList.length === 0 && installedRawOutput" class="installed-empty">
                  {{ language.pluginInstalledEmpty }}
                </div>
                <n-virtual-list
                  v-else
                  :items="installedItems"
                  :item-size="72"
                  item-resizable
                  key-field="key"
                  class="installed-virtual"
                >
                  <template #default="{ item }">
                    <div class="installed-card">
                      <div class="installed-icon">
                        <span :style="{ background: installedColor(item) }">{{ installedInitial(item) }}</span>
                      </div>
                      <div class="installed-body">
                        <div class="installed-name">{{ item.name }}</div>
                        <div class="installed-sub" v-if="item.version || item.profile">
                          <span v-if="item.version">v{{ item.version }}</span>
                          <span v-if="item.profile">@{{ item.profile }}</span>
                        </div>
                        <div class="installed-desc" v-if="item.description">{{ item.description }}</div>
                      </div>
                      <div class="installed-foot">
                        <n-button
                          size="tiny"
                          type="warning"
                          :loading="pluginBusy"
                          :disabled="pluginBusy"
                          @click="updateInstalledPlugin(item)"
                        >
                          {{ language.pluginUpdate }}
                        </n-button>
                        <n-button
                          size="tiny"
                          quaternary
                          :loading="pluginBusy"
                          :disabled="pluginBusy"
                          @click="onUninstallPlugin(item)"
                        >
                          {{ language.pluginInstalledRemove }}
                        </n-button>
                      </div>
                    </div>
                  </template>
                </n-virtual-list>
              </n-spin>
            </div>

            <details v-if="installedRawOutput" class="installed-raw">
              <summary>{{ language.pluginLogStdout }}</summary>
              <pre>{{ installedRawOutput }}</pre>
            </details>
          </template>

          <!-- 备份与恢复 -->
          <template v-else-if="pluginSubView === 'backup'">
            <div class="backup-panel">
              <!-- 导出 -->
              <div class="backup-card">
                <div class="backup-card-head">
                  <div class="backup-card-title">{{ language.backupSectionExport }}</div>
                  <div class="backup-card-sub">{{ language.pluginBackupSub }}</div>
                </div>
                <div class="backup-form-row">
                  <span class="backup-label">{{ language.backupProfile }}</span>
                  <n-input v-model:value="backupForm.profile" size="small" style="width: 140px" :disabled="backupBusy" />
                  <n-button size="small" type="primary" :loading="backupBusy" :disabled="backupBusy || !hasSelectedVersion" @click="backupExport">
                    {{ language.backupExportBtn }}
                  </n-button>
                  <n-button size="small" :disabled="backupBusy || !backupLastExport" @click="backupSaveLocal">
                    {{ language.backupExportLocal }}
                  </n-button>
                  <n-button size="small" quaternary :disabled="backupBusy || !backupLastExport" @click="backupCopyJson">
                    {{ language.backupExportCopy }}
                  </n-button>
                </div>
                <div v-if="backupLastExport" class="backup-export-preview">
                  <details>
                    <summary>{{ language.backupExported }} · {{ backupLastExport.plugins?.length || 0 }} plugins · {{ formatBackupTime(backupLastExport.exportedAt) }}</summary>
                    <pre>{{ JSON.stringify(backupLastExport, null, 2) }}</pre>
                  </details>
                </div>
              </div>

              <!-- 恢复（合并） -->
              <div class="backup-card">
                <div class="backup-card-head">
                  <div class="backup-card-title">{{ language.backupSectionImport }}</div>
                  <div class="backup-card-sub">{{ language.backupMergeHint }}</div>
                </div>
                <div class="backup-form-row">
                  <n-button size="small" type="warning" :loading="backupBusy" :disabled="backupBusy || !hasSelectedVersion" @click="backupImportLocal">
                    {{ language.backupImportBtn }}
                  </n-button>
                  <n-button size="small" :loading="backupBusy" :disabled="backupBusy || !hasSelectedVersion || !backupLastExport" @click="backupRestoreFromExport">
                    {{ language.backupImportBtn }} ({{ language.backupExported }})
                  </n-button>
                </div>
                <div v-if="backupImportResult" class="backup-import-result">
                  <n-tag :type="backupImportResult.failed > 0 ? 'warning' : 'success'" size="small">
                    {{ language.backupImportSummary(backupImportResult.installed.length, backupImportResult.skipped.length, backupImportResult.failed.length, backupImportResult.rolledback.length) }}
                  </n-tag>
                </div>
              </div>

              <!-- 云同步 -->
              <div class="backup-card">
                <div class="backup-card-head">
                  <div class="backup-card-title">{{ language.backupSectionSync }}</div>
                </div>
                <n-tabs type="line" size="small" animated>
                  <!-- WebDAV -->
                  <n-tab-pane name="webdav">
                    <template #tab>{{ language.backupWebdav }}</template>
                    <div class="backup-sync-form">
                      <div class="backup-form-row">
                        <span class="backup-label">{{ language.backupWebdavUrl }}</span>
                        <n-input v-model:value="backupForm.webdav.url" size="small" placeholder="https://dav.example.com/" :disabled="backupBusy" style="flex: 1" />
                      </div>
                      <div class="backup-form-row">
                        <span class="backup-label">{{ language.backupWebdavUser }}</span>
                        <n-input v-model:value="backupForm.webdav.username" size="small" :disabled="backupBusy" style="width: 180px" />
                        <span class="backup-label">{{ language.backupWebdavPass }}</span>
                        <n-input v-model:value="backupForm.webdav.password" type="password" show-password-on="click" size="small" :disabled="backupBusy" style="width: 180px" />
                      </div>
                      <div class="backup-form-row">
                        <span class="backup-label">{{ language.backupWebdavPath }}</span>
                        <n-input v-model:value="backupForm.webdav.path" size="small" :disabled="backupBusy" style="width: 180px" />
                        <span class="backup-label">{{ language.backupWebdavFilename }}</span>
                        <n-input v-model:value="backupForm.webdav.filename" size="small" :disabled="backupBusy" style="width: 180px" />
                      </div>
                      <div class="backup-form-row">
                        <n-button size="small" :loading="backupTesting === 'webdav'" :disabled="backupBusy || !backupForm.webdav.url" @click="backupTestWebdav">{{ language.backupWebdavTest }}</n-button>
                        <n-button size="small" type="primary" :loading="backupBusy" :disabled="backupBusy || !backupLastExport || !backupForm.webdav.url" @click="backupPushWebdav">{{ language.backupWebdavPush }}</n-button>
                        <n-button size="small" :loading="backupBusy" :disabled="backupBusy || !backupForm.webdav.url" @click="backupPullWebdav">{{ language.backupWebdavPull }}</n-button>
                      </div>
                    </div>
                  </n-tab-pane>
                  <!-- Gist -->
                  <n-tab-pane name="gist">
                    <template #tab>{{ language.backupGist }}</template>
                    <div class="backup-sync-form">
                      <div class="backup-form-row">
                        <span class="backup-label">{{ language.backupGistToken }}</span>
                        <n-input v-model:value="backupForm.gist.token" type="password" show-password-on="click" size="small" :disabled="backupBusy" style="flex: 1" placeholder="github_pat_..." />
                      </div>
                      <div class="backup-form-row">
                        <span class="backup-label">{{ language.backupGistId }}</span>
                        <n-input v-model:value="backupForm.gist.gistId" size="small" :disabled="backupBusy" style="flex: 1" placeholder="" />
                      </div>
                      <div class="backup-form-row">
                        <span class="backup-label">{{ language.backupGistFilename }}</span>
                        <n-input v-model:value="backupForm.gist.filename" size="small" :disabled="backupBusy" style="width: 200px" />
                      </div>
                      <div class="backup-hint">{{ language.backupGistHint }}</div>
                      <div class="backup-form-row">
                        <n-button size="small" :loading="backupTesting === 'gist'" :disabled="backupBusy || !backupForm.gist.token" @click="backupTestGist">{{ language.backupGistTest }}</n-button>
                        <n-button size="small" type="primary" :loading="backupBusy" :disabled="backupBusy || !backupLastExport || !backupForm.gist.token" @click="backupPushGist">{{ language.backupGistPush }}</n-button>
                        <n-button size="small" :loading="backupBusy" :disabled="backupBusy || !backupForm.gist.token || !backupForm.gist.gistId" @click="backupPullGist">{{ language.backupGistPull }}</n-button>
                      </div>
                    </div>
                  </n-tab-pane>
                </n-tabs>
              </div>

              <!-- 自动备份 -->
              <div class="backup-card">
                <div class="backup-card-head">
                  <div class="backup-card-title">{{ language.backupSectionAuto }}</div>
                  <div class="backup-card-sub">{{ language.backupAutoLastRun(backupAutoLastRunLabel) }}</div>
                </div>
                <div class="backup-form-row">
                  <n-switch v-model:value="backupForm.autoBackup.enabled" :disabled="backupBusy" />
                  <span class="backup-label">{{ language.backupAutoEnabled }}</span>
                  <span class="backup-label">{{ language.backupAutoTarget }}</span>
                  <n-select v-model:value="backupForm.autoBackup.target" size="small" :disabled="backupBusy" :options="backupTargetOptions" style="width: 140px" />
                  <span class="backup-label">{{ language.backupAutoInterval }}</span>
                  <n-input-number v-model:value="backupForm.autoBackup.intervalHours" size="small" :min="1" :max="720" :disabled="backupBusy" style="width: 110px" />
                </div>
                <div class="backup-form-row">
                  <n-button size="small" type="primary" :loading="backupBusy" :disabled="backupBusy" @click="backupSaveConfig">{{ language.backupSaveConfig }}</n-button>
                  <n-button size="small" :loading="backupBusy" :disabled="backupBusy || !hasSelectedVersion" @click="backupRunAuto">{{ language.backupAutoNow }}</n-button>
                </div>
              </div>
            </div>
          </template>

          <!-- 诊断 -->
          <template v-else>
            <div class="diagnostic-toolbar">
              <div class="diagnostic-meta">
                <div class="diag-title">{{ language.pluginDiagnosticTitle }}</div>
                <div class="diag-sub">{{ language.pluginDiagnosticSub }}</div>
              </div>
            </div>
            <div class="preset-row">
              <span class="preset-title">{{ language.commandPresetTitle }}</span>
              <button
                v-for="preset in presetCommands"
                :key="preset.command"
                type="button"
                class="preset-chip"
                :disabled="pluginBusy || !hasSelectedVersion"
                @click="runPreset(preset.command)"
              >
                {{ preset.label }}
              </button>
            </div>
            <div class="command-row">
              <n-input
                v-model:value="pluginCommand"
                type="textarea"
                :rows="2"
                :placeholder="language.pluginCommandPlaceholder"
                :disabled="pluginBusy"
                clearable
                size="small"
                class="command-input"
                @keydown.enter.prevent="onCommandEnter"
              />
              <div class="command-actions">
                <n-button size="small" quaternary :disabled="pluginBusy" @click="pasteFromClipboard">
                  <template #icon><n-icon><ClipboardIcon /></n-icon></template>
                  {{ language.pluginPaste }}
                </n-button>
                <n-button size="small" quaternary :disabled="pluginBusy" @click="clearPluginLog">
                  <template #icon><n-icon><TrashIcon /></n-icon></template>
                  {{ language.pluginCommandClear }}
                </n-button>
                <n-button
                  size="small"
                  type="error"
                  :loading="pluginTerminating"
                  :disabled="pluginBusy === null || !pluginBusy"
                  @click="terminateCommand"
                >
                  {{ language.pluginCommandTerminate }}
                </n-button>
                <n-button
                  size="small"
                  type="primary"
                  :loading="pluginBusy"
                  :disabled="pluginBusy || !canRunCommand"
                  @click="runDiagnostic"
                >
                  <template #icon><n-icon><PlayIcon /></n-icon></template>
                  {{ pluginBusy ? language.pluginCommandRunning : language.pluginCommandRun }}
                </n-button>
              </div>
            </div>
            <div class="installer-hint" v-if="!hasSelectedVersion">{{ language.pluginNoVersion }}</div>

            <div class="plugin-log">
              <div class="log-header">{{ language.pluginLogTitle }}</div>
              <div class="log-body" ref="logBody">
                <div v-if="pluginLog.length === 0" class="log-empty">{{ language.pluginLogEmpty }}</div>
                <div
                  v-for="(entry, index) in pluginLog"
                  :key="index"
                  class="log-line"
                  :class="`log-${entry.level}`"
                >
                  <span class="log-time">{{ formatLogTime(entry.ts) }}</span>
                  <span class="log-level">{{ logLevelLabel(entry.level) }}</span>
                  <span class="log-text">{{ entry.line }}</span>
                </div>
              </div>
            </div>
          </template>
        </section>
      </template>
    </main>

    <!-- 源管理弹窗 -->
    <n-modal
      v-model:show="showSourceModal"
      preset="card"
      :title="language.pluginSourceManageTitle"
      style="max-width: 640px"
      :bordered="false"
      size="medium"
    >
      <div class="source-modal-body">
        <div class="source-list-head">
          <n-button size="small" type="primary" @click="addSourceRow">
            {{ language.pluginSourceAdd }}
          </n-button>
        </div>
        <div
          v-for="(row, index) in editingSources"
          :key="index"
          class="source-row"
        >
          <n-input
            v-model:value="row.name"
            size="small"
            :placeholder="language.pluginSourceNamePlaceholder"
            class="src-field src-name"
          />
          <n-input
            v-model:value="row.endpoint"
            size="small"
            :placeholder="language.pluginSourceEndpointPlaceholder"
            class="src-field src-endpoint"
          />
          <n-input
            v-model:value="row.website"
            size="small"
            :placeholder="language.pluginSourceWebsitePlaceholder"
            class="src-field src-website"
          />
          <n-checkbox v-model:checked="row.isDefault" class="src-default" @update:checked="onDefaultChange(index)">
            {{ language.pluginSourceDefault }}
          </n-checkbox>
          <n-button size="small" quaternary type="error" :disabled="editingSources.length <= 1" @click="removeSourceRow(index)">
            {{ language.pluginSourceDelete }}
          </n-button>
        </div>
      </div>
      <template #footer>
        <div class="source-modal-footer">
          <n-button size="small" @click="showSourceModal = false">{{ language.pluginSourceCancel }}</n-button>
          <n-button size="small" type="primary" :loading="sourceSaving" @click="saveSources">
            {{ language.pluginSourceSave }}</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 卸载确认弹窗 -->
    <n-modal
      v-model:show="showUninstallConfirm"
      preset="dialog"
      :title="language.pluginUninstallConfirmTitle"
      :mask-closable="!pluginBusy"
      :close-on-esc="!pluginBusy"
      :show-icon="true"
      type="warning"
      :bordered="false"
      style="max-width: 420px"
    >
      <div class="uninstall-confirm-body">
        <div class="uninstall-confirm-text">
          {{ language.pluginUninstallConfirmContent(uninstallTarget?.name || '') }}
        </div>
        <div class="uninstall-confirm-tip">
          {{ language.pluginInstalledRestartHint }}
        </div>
      </div>
      <template #action>
        <div class="uninstall-confirm-actions">
          <n-button :disabled="pluginBusy" @click="showUninstallConfirm = false">
            {{ language.pluginUninstallConfirmCancel }}
          </n-button>
          <n-button
            type="error"
            :loading="pluginBusy"
            :disabled="pluginBusy || !uninstallTarget"
            @click="uninstallInstalledPlugin"
          >
            {{ language.pluginUninstallConfirmOk }}
          </n-button>
        </div>
      </template>
    </n-modal>

    <!-- 版本卸载确认弹窗 -->
    <n-modal
      v-model:show="showVersionUninstallConfirm"
      preset="dialog"
      :title="language.versionUninstallConfirmTitle"
      :mask-closable="busyAction === null"
      :close-on-esc="busyAction === null"
      :show-icon="true"
      type="warning"
      :bordered="false"
      style="max-width: 420px"
    >
      <div class="uninstall-confirm-body">
        <div class="uninstall-confirm-text">
          {{ language.versionUninstallConfirmContent(versionUninstallTarget) }}
        </div>
        <div class="uninstall-confirm-tip">
          {{ language.versionUninstallConfirmTip }}
        </div>
      </div>
      <template #action>
        <div class="uninstall-confirm-actions">
          <n-button :disabled="busyAction !== null" @click="showVersionUninstallConfirm = false">
            {{ language.versionUninstallConfirmCancel }}
          </n-button>
          <n-button
            type="error"
            :loading="busyAction !== null && busyAction.startsWith('uninstall:')"
            :disabled="busyAction !== null || !versionUninstallTarget"
            @click="confirmVersionUninstall"
          >
            {{ language.versionUninstallConfirmOk }}
          </n-button>
        </div>
      </template>
    </n-modal>

    <!-- 底部状态栏 -->
    <footer class="dsh-footer">
      <span :class="{ 'error-message': snapshot.error }">
        {{ localizeMessage(snapshot.locale, snapshot.error ?? message) }}
      </span>
    </footer>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch, h } from 'vue';
import semver from 'semver';
import {
  NButton, NIcon, NTag, NInput, NCheckbox, NTabs, NTabPane, NEmpty, NDropdown,
  NSelect, NModal, NSpin, NVirtualList, NSwitch, NInputNumber, useMessage,
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

// ===== 视图切换 =====
const view = ref('manager');
const pageTitle = computed(() => view.value === 'plugins' ? language.value.pluginMarket : language.value.versionManager);
const pageTitleSub = computed(() => view.value === 'plugins' ? language.value.pluginMarketSub : language.value.communityClient);

// ===== 插件市场 =====
const DEFAULT_PLUGIN_SOURCE = 'https://awesome-dsh-plugin.com';
const PLUGIN_COMMAND_REGEX = /^dsh\s+plugin\s+--profile\s+[A-Za-z0-9_-]+\s+add\s+\S+$/;
const DSH_COMMAND_REGEX = /^dsh(\s+\S+){0,32}$/;
const DSH_TOKEN_REGEX = /^[A-Za-z0-9_./:#@?&=%+,-]+$/;
const PLUGIN_SOURCE_REGEX = /^https:\/\/[A-Za-z0-9.\-]+(?::\d+)?(?:\/[^\s?#]*)?$/;
const THEME_CATEGORY_KEYS = new Set(['theme', 'themes', '主题', 'ui']);

// 源管理：从 snapshot 读取，支持增删改查
const pluginSources = computed(() => snapshot.value.pluginSources || []);
const selectedSourceId = ref('');
const showSourceModal = ref(false);
const sourceSaving = ref(false);
const editingSources = ref([]);
const showUninstallConfirm = ref(false);
const uninstallTarget = ref(null);

const selectedSource = computed(() =>
  pluginSources.value.find((s) => s.id === selectedSourceId.value) || pluginSources.value.find((s) => s.isDefault) || pluginSources.value[0] || null
);
const selectedSourceWebsite = computed(() => selectedSource.value?.website || '');

const sourceSelectOptions = computed(() =>
  pluginSources.value.map((s) => ({
    label: s.isDefault ? `${s.name} (★)` : s.name,
    value: s.id,
  }))
);

function onSourceChange(id) {
  selectedSourceId.value = id;
  const src = pluginSources.value.find((s) => s.id === id);
  if (src) {
    pluginCategory.value = '__all';
    pluginSearch.value = '';
    pluginSort.value = 'default';
    void loadPlugins();
  }
}

// 弹窗：打开时拷贝当前源列表到 editingSources
watch(showSourceModal, (show) => {
  if (show) {
    editingSources.value = pluginSources.value.map((s) => ({ ...s }));
  }
});

function addSourceRow() {
  editingSources.value.push({
    id: `source-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    endpoint: '',
    website: '',
    isDefault: editingSources.value.length === 0,
  });
}

function removeSourceRow(index) {
  if (editingSources.value.length <= 1) return;
  const removed = editingSources.value.splice(index, 1)[0];
  if (removed?.isDefault && editingSources.value.length > 0) {
    editingSources.value[0].isDefault = true;
  }
}

function onDefaultChange(index) {
  editingSources.value.forEach((s, i) => {
    if (i !== index) s.isDefault = false;
  });
}

async function saveSources() {
  // 校验
  for (const row of editingSources.value) {
    if (!row.name.trim()) {
      message?.error?.(language.value.pluginSourceNameRequired);
      return;
    }
    if (!row.endpoint.trim()) {
      message?.error?.(language.value.pluginSourceEndpointRequired);
      return;
    }
    if (!PLUGIN_SOURCE_REGEX.test(row.endpoint.trim())) {
      message?.error?.(language.value.pluginSourceInvalid);
      return;
    }
  }
  if (editingSources.value.length === 0) {
    message?.error?.(language.value.pluginSourceAtLeastOne);
    return;
  }
  // 确保有默认源
  if (!editingSources.value.some((s) => s.isDefault)) {
    editingSources.value[0].isDefault = true;
  }
  sourceSaving.value = true;
  try {
    const normalized = editingSources.value.map((s) => ({
      id: s.id,
      name: s.name.trim(),
      endpoint: s.endpoint.trim(),
      website: s.website.trim(),
      isDefault: s.isDefault,
    }));
    if (api?.setPluginSources) {
      const result = await api.setPluginSources(normalized);
      // result 是新的 snapshot，更新本地
      if (result && typeof result === 'object') {
        Object.assign(snapshot.value, result);
        // 选中新默认源
        const newDefault = result.pluginSources?.find((s) => s.isDefault) || result.pluginSources?.[0];
        if (newDefault) {
          selectedSourceId.value = newDefault.id;
        }
      }
    }
    showSourceModal.value = false;
    message?.success?.(language.value.pluginSourceSaved);
    void loadPlugins();
  } catch (error) {
    const msg = localizeMessage(snapshot.value.locale, error instanceof Error ? error.message : language.value.pluginSourceSaveFailed);
    message?.error?.(msg, { duration: 6000 });
  } finally {
    sourceSaving.value = false;
  }
}
const pluginCommand = ref('');
const pluginLog = ref([]);
const pluginBusy = ref(false);
const pluginLoading = ref(false);
const pluginTerminating = ref(false);
const pluginMarket = ref(null);
const pluginSearch = ref('');
const pluginCategory = ref('__all');
const pluginSort = ref('default');
const detectedCommand = ref(null);
const dismissedCommands = new Set();
const logBody = ref(null);
let unsubscribePluginProgress = null;
let pluginFetchToken = 0;
const brokenIconPlugins = new Set();

// 5 个子标签
const pluginSubView = ref('discover');

// 已安装插件
const installedList = ref([]);
const installedRawOutput = ref('');
const installedProfile = ref('');

// ===== 备份与恢复 =====
const backupBusy = ref(false);
const backupTesting = ref(''); // '' | 'webdav' | 'gist'
const backupLastExport = ref(null); // 上次导出的备份对象
const backupImportResult = ref(null); // { installed, skipped, failed, rolledback }
// 备份配置表单（从 snapshot.backupConfig 同步）
const backupForm = ref({
  profile: 'web',
  webdav: { url: '', username: '', password: '', path: '/dsh-backups', filename: 'dsh-backup.json' },
  gist: { token: '', gistId: '', filename: 'dsh-backup.json' },
  autoBackup: { enabled: false, target: 'local', intervalHours: 24, lastRun: null },
});

const backupTargetOptions = computed(() => [
  { label: language.value.backupAutoLocal, value: 'local' },
  { label: language.value.backupWebdav, value: 'webdav' },
  { label: language.value.backupGist, value: 'gist' },
]);

const backupAutoLastRunLabel = computed(() => {
  const t = backupForm.value.autoBackup?.lastRun;
  if (!t) return language.value.backupNever;
  try { return new Date(t).toLocaleString(snapshot.value.locale || 'zh-CN'); }
  catch { return String(t); }
});

// 从 snapshot 同步备份配置到表单
watch(() => snapshot.value.backupConfig, (cfg) => {
  if (!cfg) return;
  backupForm.value = JSON.parse(JSON.stringify(cfg));
}, { immediate: true, deep: false });

// 剥离 Vue 响应式代理，转成可被 IPC 结构化克隆的普通对象
// 避免 "An object could not be cloned." 错误
function toPlain(obj) {
  if (obj == null) return obj;
  return JSON.parse(JSON.stringify(obj));
}

function formatBackupTime(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(snapshot.value.locale || 'zh-CN'); }
  catch { return iso; }
}

async function backupExport() {
  if (!hasSelectedVersion.value) { message?.error?.(language.value.pluginNoVersion); return; }
  if (!api?.backupExport) { message?.error?.(language.value.backupValidationFailed); return; }
  backupBusy.value = true;
  try {
    const profile = backupForm.value.profile?.trim() || 'web';
    const backup = await api.backupExport(profile);
    backupLastExport.value = backup;
    message?.success?.(language.value.backupExported);
  } catch (error) {
    message?.error?.(localizeMessage(snapshot.value.locale, error instanceof Error ? error.message : language.value.failed), { duration: 6000 });
  } finally {
    backupBusy.value = false;
  }
}

async function backupSaveLocal() {
  if (!backupLastExport.value) return;
  if (!api?.backupLocalSave) return;
  try {
    const backup = toPlain(backupLastExport.value);
    const result = await api.backupLocalSave(backup, `dsh-backup-${backup.profile}-${Date.now()}.json`);
    if (result?.ok) message?.success?.(language.value.backupSyncPushed);
  } catch (error) {
    message?.error?.(error instanceof Error ? error.message : language.value.failed);
  }
}

async function backupCopyJson() {
  if (!backupLastExport.value) return;
  const text = JSON.stringify(backupLastExport.value, null, 2);
  if (api?.writeClipboard) {
    await api.writeClipboard(text);
    message?.success?.(language.value.backupExportCopy);
  }
}

async function backupImportLocal() {
  if (!hasSelectedVersion.value) { message?.error?.(language.value.pluginNoVersion); return; }
  if (!api?.backupLocalLoad || !api?.backupImport) { message?.error?.(language.value.backupValidationFailed); return; }
  try {
    const loadResult = await api.backupLocalLoad();
    if (!loadResult?.ok || !loadResult.backup) return; // 用户取消
    await runBackupImport(loadResult.backup);
  } catch (error) {
    message?.error?.(error instanceof Error ? error.message : language.value.failed, { duration: 6000 });
  }
}

async function backupRestoreFromExport() {
  if (!backupLastExport.value) return;
  await runBackupImport(backupLastExport.value);
}

async function runBackupImport(backup) {
  if (!backup) return;
  backupBusy.value = true;
  backupImportResult.value = null;
  try {
    const result = await api.backupImport(toPlain(backup));
    backupImportResult.value = result;
    if (result.failed.length > 0) {
      message?.warning?.(language.value.backupImportSummary(result.installed.length, result.skipped.length, result.failed.length, result.rolledback.length), { duration: 8000 });
    } else {
      message?.success?.(language.value.backupImported);
    }
    // 恢复后刷新已安装列表
    if (typeof refreshInstalled === 'function') await refreshInstalled();
  } catch (error) {
    message?.error?.(localizeMessage(snapshot.value.locale, error instanceof Error ? error.message : language.value.failed), { duration: 6000 });
  } finally {
    backupBusy.value = false;
  }
}

async function backupTestWebdav() {
  if (!api?.backupWebdavTest) return;
  backupTesting.value = 'webdav';
  try {
    await api.backupWebdavTest(toPlain(backupForm.value.webdav));
    message?.success?.(language.value.backupWebdavOk);
  } catch (error) {
    message?.error?.(error instanceof Error ? error.message : language.value.failed);
  } finally {
    backupTesting.value = '';
  }
}

async function backupPushWebdav() {
  if (!backupLastExport.value) return;
  if (!api?.backupWebdavPush) return;
  backupBusy.value = true;
  try {
    await api.backupWebdavPush(toPlain(backupLastExport.value), toPlain(backupForm.value.webdav));
    message?.success?.(language.value.backupSyncPushed);
  } catch (error) {
    message?.error?.(error instanceof Error ? error.message : language.value.failed, { duration: 6000 });
  } finally {
    backupBusy.value = false;
  }
}

async function backupPullWebdav() {
  if (!api?.backupWebdavPull) return;
  backupBusy.value = true;
  try {
    const result = await api.backupWebdavPull(toPlain(backupForm.value.webdav));
    if (result?.ok && result.backup) {
      backupLastExport.value = result.backup;
      message?.success?.(language.value.backupSyncPulled);
    }
  } catch (error) {
    message?.error?.(error instanceof Error ? error.message : language.value.failed, { duration: 6000 });
  } finally {
    backupBusy.value = false;
  }
}

async function backupTestGist() {
  if (!api?.backupGistTest) return;
  backupTesting.value = 'gist';
  try {
    const result = await api.backupGistTest(toPlain(backupForm.value.gist));
    message?.success?.(language.value.backupGistOk(result?.login || ''));
  } catch (error) {
    message?.error?.(error instanceof Error ? error.message : language.value.failed);
  } finally {
    backupTesting.value = '';
  }
}

async function backupPushGist() {
  if (!backupLastExport.value) return;
  if (!api?.backupGistPush) return;
  backupBusy.value = true;
  try {
    const result = await api.backupGistPush(toPlain(backupLastExport.value), toPlain(backupForm.value.gist));
    // 首次推送后 gistId 回写到表单（snapshot 也会通过 setBackupConfig 更新）
    if (result?.gistId && result.gistId !== backupForm.value.gist.gistId) {
      backupForm.value.gist.gistId = result.gistId;
    }
    message?.success?.(language.value.backupSyncPushed);
  } catch (error) {
    message?.error?.(error instanceof Error ? error.message : language.value.failed, { duration: 6000 });
  } finally {
    backupBusy.value = false;
  }
}

async function backupPullGist() {
  if (!api?.backupGistPull) return;
  backupBusy.value = true;
  try {
    const result = await api.backupGistPull(toPlain(backupForm.value.gist));
    if (result?.ok && result.backup) {
      backupLastExport.value = result.backup;
      message?.success?.(language.value.backupSyncPulled);
    }
  } catch (error) {
    message?.error?.(error instanceof Error ? error.message : language.value.failed, { duration: 6000 });
  } finally {
    backupBusy.value = false;
  }
}

async function backupSaveConfig() {
  if (!api?.backupSetConfig) return;
  try {
    await api.backupSetConfig(toPlain(backupForm.value));
    message?.success?.(language.value.backupConfigSaved);
  } catch (error) {
    message?.error?.(error instanceof Error ? error.message : language.value.failed);
  }
}

async function backupRunAuto() {
  if (!api?.backupAutoRun) return;
  backupBusy.value = true;
  try {
    const result = await api.backupAutoRun();
    if (result?.ok) {
      message?.success?.(language.value.backupExported);
      // 自动备份使用当前 profile 导出，把结果同步到 backupLastExport 便于查看
      if (result.backup) backupLastExport.value = result.backup;
    } else if (result?.error) {
      message?.error?.(result.error, { duration: 6000 });
    }
  } catch (error) {
    message?.error?.(error instanceof Error ? error.message : language.value.failed, { duration: 6000 });
  } finally {
    backupBusy.value = false;
  }
}

// 分类 chip：完全从接口返回的 categories 动态生成
const CATEGORY_VISIBLE_LIMIT = 10;

const canRunCommand = computed(() => DSH_COMMAND_REGEX.test(pluginCommand.value.trim()) && DSH_TOKEN_REGEX_WHOLE(pluginCommand.value.trim()));
const hasSelectedVersion = computed(() => Boolean(snapshot.value.selectedVersion));

const isZh = computed(() => (snapshot.value.locale || '').toLowerCase().startsWith('zh'));

// 颜色调色板（用于字母头像背景）
const AVATAR_PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'
];
function colorFromString(s) {
  const str = String(s || '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
function initialFromString(s) {
  const str = String(s || '').trim();
  if (!str) return '?';
  // 跳过常见前缀符号
  const m = str.match(/[A-Za-z0-9一-鿿]/);
  return m ? m[0].toUpperCase() : str[0].toUpperCase();
}

function DSH_TOKEN_REGEX_WHOLE(value) {
  if (typeof value !== 'string') return false;
  const tokens = value.trim().split(/\s+/);
  for (const token of tokens) {
    if (!token || token.length > 200) return false;
    if (!DSH_TOKEN_REGEX.test(token)) return false;
  }
  return tokens.length > 0;
}

// 从接口返回的 categories 动态生成分类 chip 列表
const categoryChipDefs = computed(() => {
  const cats = pluginMarket.value?.categories || {};
  const defs = [{ value: '__all', label: language.value.pluginCategoryAll }];
  for (const [key, meta] of Object.entries(cats)) {
    if (!meta) continue;
    const label = (isZh.value ? meta.zh : meta.en) || key;
    defs.push({ value: key, label });
  }
  return defs;
});

const visibleCategoryChips = computed(() => {
  // 主题页只显示主题类目
  if (pluginSubView.value === 'themes') {
    return categoryChipDefs.value.filter((c) => c.value === '__all' || c.value === 'theme' || c.value === 'ui');
  }
  return categoryChipDefs.value.slice(0, CATEGORY_VISIBLE_LIMIT);
});

const overflowCategoryChips = computed(() => {
  if (pluginSubView.value === 'themes') return [];
  return categoryChipDefs.value.slice(CATEGORY_VISIBLE_LIMIT);
});

const overflowCategoryOptions = computed(() => {
  return overflowCategoryChips.value.map((c) => ({ label: c.label, key: c.value }));
});

function handleOverflowCategory(value) {
  pluginCategory.value = value;
}

const pluginSortOptions = computed(() => [
  { label: language.value.pluginSortDefault, value: 'default' },
  { label: language.value.pluginSortPopular, value: 'popular' },
  { label: language.value.pluginSortLatest, value: 'latest' },
  { label: language.value.pluginSortRecommended, value: 'recommended' },
]);

const filteredPlugins = computed(() => {
  const list = pluginMarket.value?.plugins || [];
  const q = pluginSearch.value.trim().toLowerCase();
  // 主题页自动叠加主题过滤
  let activeCategory = pluginCategory.value;
  if (pluginSubView.value === 'themes' && !['__all', 'theme', 'ui'].includes(activeCategory)) {
    activeCategory = '__all';
  }
  const filtered = list.filter((p) => {
    if (activeCategory !== '__all') {
      // 主题页对 category 为 theme/themes 的也命中
      if (pluginSubView.value === 'themes' && activeCategory === 'theme') {
        if (!THEME_CATEGORY_KEYS.has(p.category) && p.category !== 'theme') return false;
      } else if (p.category !== activeCategory) {
        return false;
      }
    }
    if (!q) return true;
    const hay = [p.name, p.owner, p.npm, p.description?.zh, p.description?.en, p.install, ...(p.tags || [])]
      .filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });
  // 排序：默认保持市场源返回的原始顺序
  const result = [...filtered];
  switch (pluginSort.value) {
    case 'popular':
      result.sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0) || String(a.name).localeCompare(String(b.name)));
      break;
    case 'latest': {
      const ts = (p) => {
        const raw = p.publishedAt || p.updated || p.date;
        if (!raw) return 0;
        const t = new Date(raw).getTime();
        return Number.isFinite(t) ? t : 0;
      };
      result.sort((a, b) => ts(b) - ts(a) || String(a.name).localeCompare(String(b.name)));
      break;
    }
    case 'recommended': {
      const score = (p) => (p.installs ?? p.downloads ?? 0) * 1 + (p.stars ?? 0) * 0.5;
      result.sort((a, b) => score(b) - score(a) || String(a.name).localeCompare(String(b.name)));
      break;
    }
    // default：保持原始顺序
  }
  return result;
});

function pluginKey(p) {
  return `${p.owner || ''}/${p.name}`;
}

// 为虚拟列表准备的带 key 数组
// 为虚拟列表准备：每3个插件分成一行，虚拟列表按行渲染
const PLUGIN_COLS = 3;
const pluginItems = computed(() => {
  const list = filteredPlugins.value;
  const rows = [];
  for (let i = 0; i < list.length; i += PLUGIN_COLS) {
    const row = list.slice(i, i + PLUGIN_COLS);
    rows.push({
      key: row.map(pluginKey).join('|'),
      plugins: row,
    });
  }
  return rows;
});

function pluginDescription(p) {
  const d = p.description || {};
  return (isZh.value ? d.zh : d.en) || d.en || d.zh || '';
}

function pluginCategoryLabel(p) {
  const cats = pluginMarket.value?.categories || {};
  const meta = cats[p.category];
  if (meta) return (isZh.value ? meta.zh : meta.en) || p.category || '';
  return p.category || '';
}

function pluginPageUrl(p) {
  const candidates = [p.url, p.page, p.website];
  return candidates.find((value) => typeof value === 'string' && /^https:\/\//i.test(value.trim()))?.trim() || '';
}

function openPluginPage(plugin) {
  const url = pluginPageUrl(plugin);
  if (url) openExternal(url);
}

function pluginIcon(p) {
  if (brokenIconPlugins.has(pluginKey(p))) return '';
  return p.icon || p.iconUrl || p.avatar || '';
}

function pluginInitial(p) {
  return initialFromString(p.name || p.owner || '?');
}

function pluginColor(p) {
  return colorFromString(p.owner || p.name || '');
}

function onIconError(p) {
  brokenIconPlugins.add(pluginKey(p));
}

function pluginPublishedAt(p) {
  const v = p.publishedAt || p.published_at || p.updatedAt || p.updated_at;
  if (!v) return '';
  const date = new Date(v);
  if (Number.isNaN(date.getTime())) return String(v).slice(0, 10);
  return new Intl.DateTimeFormat(snapshot.value.locale, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function pluginSourceTag(p) {
  // 显示插件来源类型（源码/包等），可来自数据中 type / sourceType / tag
  if (typeof p.type === 'string' && p.type.trim()) return p.type;
  if (typeof p.sourceType === 'string' && p.sourceType.trim()) return p.sourceType;
  if (Array.isArray(p.tags) && p.tags.length > 0) return String(p.tags[0]);
  if (typeof p.tag === 'string' && p.tag.trim()) return p.tag;
  return '';
}

function pluginExtraTags(p) {
  if (Array.isArray(p.tags) && p.tags.length > 1) return p.tags.slice(1, 4);
  return [];
}

function formatStars(n) {
  if (n == null) return '';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const PLUGIN_CACHE_KEY_PREFIX = 'plugin-market-cache:';
const PLUGIN_CACHE_TTL = 10 * 60 * 1000; // 10 分钟

async function loadPlugins() {
  if (!api?.fetchPluginMarket) return;
  const src = selectedSource.value;
  if (!src) return;
  pluginLoading.value = true;
  const token = ++pluginFetchToken;
  try {
    // 优先使用本地缓存，避免频繁请求
    const cacheKey = `${PLUGIN_CACHE_KEY_PREFIX}${src.id}`;
    const cachedRaw = localStorage.getItem(cacheKey);
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw);
        if (cached && cached.data && typeof cached.ts === 'number' && Date.now() - cached.ts < PLUGIN_CACHE_TTL) {
          if (token !== pluginFetchToken) return;
          pluginMarket.value = cached.data;
          return;
        }
      } catch {
        localStorage.removeItem(cacheKey);
      }
    }
    const data = await api.fetchPluginMarket(src.endpoint);
    if (token !== pluginFetchToken) return; // 已被新的请求覆盖
    if (!data || typeof data !== 'object') throw new Error('Invalid response');
    pluginMarket.value = data;
    // 写入缓存
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }));
    } catch {
      // 存储满等异常忽略，不影响主流程
    }
    // 校验当前分类是否仍在选项中
    if (pluginCategory.value !== '__all' && !data.categories?.[pluginCategory.value]) {
      pluginCategory.value = '__all';
    }
  } catch (error) {
    if (token !== pluginFetchToken) return;
    pluginMarket.value = null;
    const msg = localizeMessage(snapshot.value.locale, error instanceof Error ? error.message : language.value.pluginLoadFailed);
    message?.error?.(msg, { duration: 6000 });
  } finally {
    if (token === pluginFetchToken) pluginLoading.value = false;
  }
}

async function copyInstall(plugin) {
  const cmd = plugin.install || '';
  if (!cmd) return;
  if (api?.writeClipboard) {
    const ok = await api.writeClipboard(cmd);
    if (ok) {
      message?.success?.(language.value.pluginCopied);
      return;
    }
  }
  // 兜底：填入安装框
  pluginCommand.value = cmd;
  message?.success?.(language.value.pluginCopied);
}

async function installFromCard(plugin) {
  const cmd = plugin.install || '';
  if (!cmd) return;
  pluginCommand.value = cmd;
  // 切到诊断页方便查看日志
  pluginSubView.value = 'diagnostic';
  await runPluginInstall(cmd);
}

// ===== 已安装（dsh plugin list）=====
async function refreshInstalled() {
  if (!hasSelectedVersion.value) {
    message?.error?.(language.value.pluginNoVersion);
    return;
  }
  if (!api?.runPluginCommand) {
    message?.error?.(language.value.pluginInstallFailed);
    return;
  }
  // 推断激活的 profile：当前 pluginCommand 中可能包含 --profile <name>，否则默认 web
  const inferredProfile = inferProfileFromCommand(pluginCommand.value)
    || (installedProfile.value)
    || 'web';
  installedProfile.value = inferredProfile;
  const cmd = `dsh plugin --profile ${inferredProfile} list`;
  pluginCommand.value = cmd;
  await runDiagnostic({ silent: true, listMode: true, returnTo: 'installed' });
}

function inferProfileFromCommand(value) {
  if (typeof value !== 'string') return '';
  const m = /dsh\s+plugin\s+--profile\s+([A-Za-z0-9_-]+)/.exec(value);
  return m ? m[1] : '';
}

function parseInstalledOutput(raw) {
  if (!raw) return [];
  const trimmed = raw.trim();

  // 1) 尝试 JSON
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.plugins) ? parsed.plugins : null);
      if (arr) return arr.map((it) => normalizeInstalledItem(it));
    } catch { /* 忽略，按文本解析 */ }
  }

  // 2) 解析 npm-list 风格的树形输出
  //    格式示例：
  //    Legend: production dependency, optional only, dev only
  //    dsh-profile-web C:\Users\... (PRIVATE)
  //    │
  //    │   dependencies:
  //    └── dshmarket@1.13.1
  //    1 package
  const items = [];
  const lines = trimmed.split(/\r?\n/);
  // 匹配树形节点：├── / └── / │   ├── / 空格 ├── 等
  const NODE_RE = /[├└]──\s+(.+)/;
  // 匹配 name@version（去掉尾部括号标注如 deduped, extraneous）
  const PKG_RE = /^(@?[^@\s]+)@([^\s]+)/;
  // 需要跳过的行
  const SKIP_RE = /^(Legend:|dsh-profile|\s*[│├└─]*\s*$|.*\d+\s+package)/i;

  for (const line of lines) {
    const nodeMatch = NODE_RE.exec(line);
    if (!nodeMatch) continue;
    const rest = nodeMatch[1].trim();
    if (!rest || SKIP_RE.test(rest)) continue;
    // 提取 name@version
    const pkgMatch = PKG_RE.exec(rest);
    if (pkgMatch) {
      items.push({
        name: pkgMatch[1],
        version: pkgMatch[2],
        profile: installedProfile.value || '',
      });
    }
  }
  return items;
}

function normalizeInstalledItem(it) {
  if (!it || typeof it !== 'object') return { name: String(it || '') };
  const name = it.name || it.ref || it.id || it.package || it.packageName || '';
  const version = it.version || it.ver || '';
  const description = it.description || it.desc || '';
  const profile = it.profile || '';
  return { name: String(name), version: String(version), description: String(description), profile: String(profile) };
}

function installedKey(item) {
  return `${item.profile || installedProfile.value || ''}/${item.name || Math.random()}`;
}

// 为虚拟列表准备的带 key 数组
const installedItems = computed(() =>
  installedList.value.map((item) => ({ ...item, key: installedKey(item) }))
);

function installedInitial(item) {
  return initialFromString(item.name || '?');
}

function installedColor(item) {
  return colorFromString(item.name || '');
}

// ===== 命令执行（任意 dsh 命令）=====
const presetCommands = computed(() => {
  const l = language.value;
  return [
    { label: l.commandPresetVersion, command: 'dsh --version' },
    { label: l.commandPresetHelp, command: 'dsh --help' },
    { label: l.commandPresetList, command: 'dsh plugin list' },
    { label: l.commandPresetListWeb, command: 'dsh plugin --profile web list' },
    { label: l.commandPresetUpdateAll, command: 'dsh plugin --profile web update' },
  ];
});

function runPreset(command) {
  pluginCommand.value = command;
  void runDiagnostic();
}

function onCommandEnter(event) {
  if (event?.shiftKey) return; // Shift+Enter 换行
  void runDiagnostic();
}

async function runDiagnostic(options = {}) {
  const { silent = false, listMode = false, returnTo = '' } = options;
  const raw = pluginCommand.value.trim();
  if (!raw) {
    if (!silent) message?.error?.(language.value.pluginCommandInvalid);
    return;
  }
  if (!DSH_COMMAND_REGEX.test(raw)) {
    if (!silent) message?.error?.(language.value.pluginCommandInvalid);
    return;
  }
  if (!hasSelectedVersion.value) {
    message?.error?.(language.value.pluginNoVersion);
    return;
  }
  if (!api?.runPluginCommand) {
    message?.error?.(language.value.pluginInstallFailed);
    return;
  }
  pluginBusy.value = true;
  pluginLog.value = [];
  try {
    const result = await api.runPluginCommand(raw);
    if (listMode) {
      const stdout = result?.stdout || '';
      installedRawOutput.value = stdout;
      installedList.value = parseInstalledOutput(stdout);
      // 推断 profile
      const m = /dsh\s+plugin\s+--profile\s+([A-Za-z0-9_-]+)/.exec(raw);
      if (m) installedProfile.value = m[1];
    }
    if (!silent) {
      message?.success?.(language.value.pluginCommandSuccess);
    }
    if (returnTo) {
      pluginSubView.value = returnTo;
    }
  } catch (error) {
    const msg = localizeMessage(snapshot.value.locale, error instanceof Error ? error.message : language.value.pluginCommandFailed);
    if (!silent) message?.error?.(msg, { duration: 6000 });
  } finally {
    pluginBusy.value = false;
  }
}

async function terminateCommand() {
  if (!api?.stopPluginCommand) {
    message?.error?.(language.value.failed);
    return;
  }
  pluginTerminating.value = true;
  try {
    const result = await api.stopPluginCommand();
    if (result?.ok) {
      message?.success?.(language.value.pluginCommandTerminated);
    } else {
      message?.warning?.(result?.message || language.value.failed);
    }
  } catch (error) {
    message?.error?.(error instanceof Error ? error.message : language.value.failed);
  } finally {
    pluginTerminating.value = false;
    pluginBusy.value = false;
  }
}

function clearPluginLog() {
  pluginLog.value = [];
}

function onUninstallPlugin(item) {
  if (!item || !item.name) return;
  uninstallTarget.value = item;
  showUninstallConfirm.value = true;
}

// 卸载单个已安装插件
async function uninstallInstalledPlugin() {
  const item = uninstallTarget.value;
  if (!item || !item.name) return;
  if (!hasSelectedVersion.value) {
    message?.error?.(language.value.pluginNoVersion);
    return;
  }
  if (!api?.runPluginCommand) {
    message?.error?.(language.value.pluginUninstallFailed);
    return;
  }
  const profile = item.profile || installedProfile.value || 'web';
  const cmd = `dsh plugin --profile ${profile} remove ${item.name}`;
  pluginCommand.value = cmd;
  // 跳到诊断页展示日志
  pluginSubView.value = 'diagnostic';
  await runDiagnostic({ silent: false, listMode: false, returnTo: 'installed' });
  // 卸载完成后自动刷新已安装列表
  await refreshInstalled();
  showUninstallConfirm.value = false;
  uninstallTarget.value = null;
}

// 更新单个已安装插件
async function updateInstalledPlugin(item) {
  if (!item || !item.name) return;
  if (!hasSelectedVersion.value) {
    message?.error?.(language.value.pluginNoVersion);
    return;
  }
  if (!api?.runPluginCommand) {
    message?.error?.(language.value.pluginUpdateFailed);
    return;
  }
  const profile = item.profile || installedProfile.value || 'web';
  const cmd = `dsh plugin --profile ${profile} update ${item.name}`;
  pluginCommand.value = cmd;
  // 跳到诊断页展示日志
  pluginSubView.value = 'diagnostic';
  await runDiagnostic({ silent: false, listMode: false, returnTo: 'installed' });
  // 更新完成后自动刷新已安装列表
  await refreshInstalled();
}

// 全部更新：依次执行 update
async function updateAllInstalled() {
  if (installedList.value.length === 0) return;
  if (!hasSelectedVersion.value) {
    message?.error?.(language.value.pluginNoVersion);
    return;
  }
  if (!api?.runPluginCommand) {
    message?.error?.(language.value.pluginUpdateFailed);
    return;
  }
  const profile = installedProfile.value || 'web';
  // 批量更新命令：dsh plugin --profile <name> update (不带插件名时更新全部)
  const cmd = `dsh plugin --profile ${profile} update`;
  pluginCommand.value = cmd;
  pluginSubView.value = 'diagnostic';
  await runDiagnostic({ silent: false, listMode: false, returnTo: 'installed' });
  await refreshInstalled();
}

function logLevelLabel(level) {
  if (level === 'stderr' || level === 'error') return language.value.pluginLogStderr;
  return language.value.pluginLogStdout;
}

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
const SettingsIcon = SvgWrapper([
  h('path', { d: 'M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53 1.95-1.52-2-3.46-2.31.93a6.5 6.5 0 0 0-1.7-.98l-.35-2.45h-4l-.35 2.45c-.62.23-1.2.56-1.7.98l-2.31-.93-2 3.46 1.95 1.52a6.5 6.5 0 0 0 0 2.06l-1.95 1.52 2 3.46 2.31-.93c.5.42 1.08.75 1.7.98l.35 2.45h4l.35-2.45a6.5 6.5 0 0 0 1.7-.98l2.31.93 2-3.46-1.95-1.52a6.5 6.5 0 0 0 0-2.06z' }),
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
const ClipboardIcon = SvgWrapper([
  h('rect', { x: '8', y: '4', width: '12', height: '16', rx: '2' }),
  h('path', { d: 'M16 4V3a1 1 0 0 0-1-1H7a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3' }),
  h('path', { d: 'M11 7h6' }),
]);
const SunIcon = SvgWrapper([
  h('circle', { cx: '12', cy: '12', r: '4' }),
  h('path', { d: 'M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' }),
]);
const MoonIcon = SvgWrapper([
  h('path', { d: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z' }),
]);
const StarIcon = SvgWrapper([
  h('path', { d: 'M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.5L12 18.8 6.1 21.6l1.2-6.5L2.5 9.5l6.6-.9z' }),
]);
const PlayIcon = SvgWrapper([
  h('path', { d: 'M6 4l14 8-14 8z' }),
]);
const TrashIcon = SvgWrapper([
  h('path', { d: 'M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13' }),
  h('path', { d: 'M10 11v6M14 11v6' }),
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

const installProgressLabel = computed(() => {
  const reportedPercent = Number(progress.value?.percent);
  const phasePercent = {
    downloading: 60,
    validating: 90,
    complete: 100,
  }[progress.value?.phase];
  const percent = Number.isFinite(reportedPercent) ? reportedPercent : phasePercent;
  return Number.isFinite(percent)
    ? `${language.value.installing}：${Math.round(percent)}%`
    : language.value.installing;
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

// ===== 主题切换 =====
const themeOptions = computed(() => [
  { label: language.value.themeFollowSystem, key: 'system' },
  { type: 'divider', key: 'd1' },
  { label: language.value.themeLight, key: 'light' },
  { label: language.value.themeDark, key: 'dark' },
]);
const themeLabel = computed(() => {
  const pref = snapshot.value.themePreference || 'system';
  if (pref === 'light') return language.value.themeLight;
  if (pref === 'dark') return language.value.themeDark;
  return language.value.themeFollowSystem;
});
const isDarkTheme = computed(() => {
  const pref = snapshot.value.themePreference || 'system';
  if (pref === 'dark') return true;
  if (pref === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
});
async function changeTheme(preference) {
  if (!preference || preference === (snapshot.value.themePreference || 'system')) return;
  try {
    const next = await api.setTheme(preference);
    Object.assign(dshStore.state.snapshot, next);
    message?.success?.(language.value.themeChanged);
  } catch (error) {
    const msg = localizeMessage(snapshot.value.locale, error instanceof Error ? error.message : language.value.themeChangeFailed);
    message?.error?.(msg);
  }
}

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

const showVersionUninstallConfirm = ref(false);
const versionUninstallTarget = ref('');

function confirmUninstallVersion(version) {
  versionUninstallTarget.value = version;
  showVersionUninstallConfirm.value = true;
}

async function confirmVersionUninstall() {
  const version = versionUninstallTarget.value;
  if (!version) return;
  await perform(`uninstall:${version}`, language.value.uninstallingVersion(version), () => api.uninstall(version));
  showVersionUninstallConfirm.value = false;
  versionUninstallTarget.value = '';
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
  // 订阅插件安装进度
  if (api?.onPluginProgress) {
    unsubscribePluginProgress = api.onPluginProgress((progress) => {
      pluginLog.value.push(progress);
      // 滚动到底部
      requestAnimationFrame(() => {
        if (logBody.value) logBody.value.scrollTop = logBody.value.scrollHeight;
      });
    });
  }
  // 切换到插件市场时首次加载列表
  watch(view, (v) => {
    if (v === 'plugins') {
      // 初始化选中默认源
      if (!selectedSourceId.value) {
        const def = pluginSources.value.find((s) => s.isDefault) || pluginSources.value[0];
        if (def) selectedSourceId.value = def.id;
      }
      if (!pluginMarket.value && !pluginLoading.value) {
        void loadPlugins();
      }
      // 预先拉取已安装列表，让 tab 标签上的数量立即可见
      if (installedList.value.length === 0 && !pluginBusy.value && hasSelectedVersion.value) {
        void refreshInstalled();
      }
    }
  });
  // 已选版本变化时刷新已安装列表（数量保持最新）
  watch(() => snapshot.value.selectedVersion, (ver) => {
    if (view.value === 'plugins' && ver && !pluginBusy.value) {
      void refreshInstalled();
    }
  });
  // 子标签切换：进入"已安装"时若尚无数据则自动拉取
  watch(pluginSubView, (v) => {
    if (v === 'installed' && installedList.value.length === 0 && !pluginBusy.value && hasSelectedVersion.value) {
      void refreshInstalled();
    }
  });
  // 窗口重获焦点时检查剪贴板
  window.addEventListener('focus', handleWindowFocus, true);
  document.addEventListener('visibilitychange', handleVisibilityChange);
});

onBeforeUnmount(() => {
  if (unsubscribePluginProgress) unsubscribePluginProgress();
  window.removeEventListener('focus', handleWindowFocus, true);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});

function handleWindowFocus() {
  if (view.value !== 'plugins') return;
  void checkClipboard();
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible' && view.value === 'plugins') {
    void checkClipboard();
  }
}

async function checkClipboard() {
  if (!api?.readClipboard) return;
  try {
    const text = await api.readClipboard();
    if (typeof text === 'string') tryDetectCommand(text);
  } catch {
    // 剪贴板读取失败时静默
  }
}

function tryDetectCommand(text) {
  const trimmed = (text || '').trim();
  if (!PLUGIN_COMMAND_REGEX.test(trimmed)) return;
  // 跳过已忽略的命令
  if (dismissedCommands.has(trimmed)) return;
  // 已经在安装中则不再覆盖
  if (pluginBusy.value) return;
  detectedCommand.value = trimmed;
  // 同时填入输入框，方便用户编辑或直接点安装
  if (!pluginCommand.value.trim()) pluginCommand.value = trimmed;
}

function dismissDetected() {
  if (detectedCommand.value) dismissedCommands.add(detectedCommand.value);
  detectedCommand.value = null;
}

async function pasteFromClipboard() {
  if (!api?.readClipboard) return;
  try {
    const text = await api.readClipboard();
    if (typeof text === 'string') pluginCommand.value = text.trim();
    // 粘贴后立即检测，触发引导条
    tryDetectCommand(text);
  } catch (error) {
    message?.error?.(error instanceof Error ? error.message : language.value.failed);
  }
}

async function installDetectedPlugin() {
  if (!detectedCommand.value) return;
  pluginCommand.value = detectedCommand.value;
  await runPluginInstall(detectedCommand.value);
}

async function runPluginInstall(command) {
  if (!PLUGIN_COMMAND_REGEX.test(command)) {
    message?.error?.(language.value.pluginCommandInvalid);
    return;
  }
  if (!hasSelectedVersion.value) {
    message?.error?.(language.value.pluginNoVersion);
    return;
  }
  if (!api?.installPlugin) {
    message?.error?.(language.value.pluginInstallFailed);
    return;
  }
  pluginBusy.value = true;
  pluginLog.value = [];
  try {
    await api.installPlugin(command);
    message?.success?.(language.value.pluginInstalled);
    message?.info?.(language.value.pluginInstalledRestartHint, { duration: 5000 });
    detectedCommand.value = null;
  } catch (error) {
    const msg = localizeMessage(snapshot.value.locale, error instanceof Error ? error.message : language.value.pluginInstallFailed);
    message?.error?.(msg, { duration: 6000 });
  } finally {
    pluginBusy.value = false;
  }
}

function formatLogTime(ts) {
  if (!ts) return '';
  try {
    return new Intl.DateTimeFormat(snapshot.value.locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(ts));
  } catch {
    return '';
  }
}
</script>

<style lang="less" scoped>
.dsh-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg-gradient);
  transition: background 0.2s ease;
}

/* ===== 顶部导航栏 ===== */
.dsh-header {
  background: var(--surface-glass);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 1px 3px var(--shadow);
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
  color: var(--text);
  letter-spacing: -0.02em;
}

.brand-sub {
  font-size: 11px;
  color: var(--text-muted);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ===== 主体内容 ===== */
.dsh-main {
  flex: 1;
  //max-width: 1200px;
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
  background: linear-gradient(135deg, var(--surface) 0%, var(--surface-soft) 100%);
  border: 1px solid var(--border);
  box-shadow: 0 4px 20px var(--shadow);
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
  background: linear-gradient(135deg, var(--code-bg), var(--surface-soft));
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
  color: var(--text-muted);
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
  color: var(--text);
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
  background: var(--code-bg);
  color: var(--text-muted);

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
  color: var(--text-muted);
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
  color: var(--text-muted);
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
  background: var(--surface);
  border: 1px solid var(--border-strong);
  transition: all 0.15s ease;

  &:hover {
    border-color: #c7d2fe;
    box-shadow: 0 4px 12px var(--shadow);
    transform: translateY(-1px);
  }

  &.is-current {
    border-color: #818cf8;
    background: linear-gradient(135deg, var(--surface), var(--surface-soft));
    box-shadow: 0 4px 16px var(--shadow);
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.card-uninstall {
  margin-left: auto;
}

.card-version {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-body);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: -0.02em;
}

.card-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-muted);
}

.card-action {
  margin-top: auto;
}

.install-progress-label {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state {
  grid-column: 1 / -1;
  display: grid;
  place-items: center;
  padding: 60px 20px;
}

/* ===== 底部状态栏 ===== */
.dsh-footer {
  border-top: 1px solid var(--border);
  background: var(--surface-glass);
  padding: 10px 24px;
  text-align: center;

  span {
    font-size: 11px;
    color: var(--text-muted);
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

  .plugin-grid {
    grid-template-columns: 1fr;
  }
}

/* ===== 视图切换标签 ===== */
.view-tabs {
  margin-bottom: 4px;

  :deep(.n-tabs-tab) {
    font-weight: 600;
  }
}

/* ===== 插件市场 ===== */
.plugin-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.plugin-subtabs {
  margin-bottom: 4px;

  :deep(.n-tabs-tab) {
    font-weight: 600;
  }
}

.plugin-detect-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  border: 1px solid #6ee7b7;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.12);
  animation: detectIn 0.25s ease-out;
}

@keyframes detectIn {
  from { transform: translateY(-4px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.detect-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.detect-title {
  font-size: 12px;
  font-weight: 600;
  color: #065f46;
}

.detect-command {
  font-family: ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace;
  font-size: 12px;
  color: #047857;
  background: rgba(255, 255, 255, 0.6);
  padding: 6px 10px;
  border-radius: 6px;
  word-break: break-all;
  white-space: pre-wrap;
}

.detect-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.market-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: 0 2px 8px var(--shadow);
  flex-wrap: wrap;
}

.market-source {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 280px;

  .source-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .source-select {
    min-width: 200px;
    max-width: 320px;
  }
}

.market-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 4px 0;
  font-size: 12px;
  color: var(--text-muted);
  flex-wrap: wrap;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.market-search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.market-search {
  flex: 1;
  min-width: 0;
}

.market-sort {
  width: 150px;
  flex-shrink: 0;
}

.category-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 4px 2px;
}

.cat-chip {
  border: 1px solid rgba(99, 102, 241, 0.15);
  background: var(--chip-bg);
  color: var(--chip-text);
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;

  &:hover {
    border-color: rgba(99, 102, 241, 0.4);
    color: #4338ca;
  }

  &.active {
    background: linear-gradient(135deg, #6366f1, #818cf8);
    border-color: #6366f1;
    color: #fff;
    box-shadow: 0 2px 6px rgba(99, 102, 241, 0.3);
  }

  &.cat-chip-more {
    color: #6366f1;
    font-weight: 600;
  }
}

.market-list {
  background: var(--surface);
  border-radius: 12px;
  border: 1px solid rgba(99, 102, 241, 0.1);
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.06);
  padding: 10px 14px;
  height: 560px;
  overflow: hidden;

  :deep(.n-spin-container) {
    height: 100%;
  }

  :deep(.n-spin-content) {
    height: 100%;
  }
}

/* Naive UI NVirtualList 内部滚动容器 */
.market-virtual {
  height: 100%;
}

.market-empty {
  padding: 40px 0;
}

.plugin-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 12px;
}

.plugin-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: rgba(99, 102, 241, 0.35);
    box-shadow: 0 4px 16px var(--shadow);
    transform: translateY(-1px);
  }
}

.plugin-icon {
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--code-bg);
  display: grid;
  place-items: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  span {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    color: #fff;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
}

.plugin-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.plugin-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.plugin-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  font-family: ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace;
}

.plugin-sub {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--text-muted);

  .sub-owner {
    color: var(--text-muted);
  }

  .sub-stars {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: #d97706;
  }

  .sub-date {
    color: var(--text-muted);
  }
}

.plugin-desc {
  font-size: 12px;
  color: var(--text-body);
  line-height: 1.55;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.plugin-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.plugin-actions {
  margin-left: auto;
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

/* ===== 已安装 ===== */
.installed-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border);
  box-shadow: 0 2px 8px var(--shadow);
  flex-wrap: wrap;
}

.installed-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.installed-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--text-muted);
  flex-wrap: wrap;
}

.meta-label {
  font-weight: 600;
}

.meta-value {
  font-family: ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace;
  background: var(--code-bg);
  color: var(--indigo-light);
  padding: 2px 8px;
  border-radius: 4px;
}

.meta-count {
  color: #10b981;
  font-weight: 600;
}

.installed-hint {
  font-size: 12px;
  color: var(--text-muted);
  padding: 4px 4px 0;
}

.installed-list {
  background: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border);
  box-shadow: 0 2px 8px var(--shadow);
  padding: 12px 14px;
  height: 420px;
  overflow: hidden;

  :deep(.n-spin-container) {
    height: 100%;
  }

  :deep(.n-spin-content) {
    height: 100%;
  }
}

.installed-virtual {
  height: 100%;
}

.installed-empty {
  padding: 60px 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.installed-card {
  display: flex;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--surface-soft);
  border: 1px solid var(--border);
  align-items: center;
  margin-bottom: 8px;
  transition: border-color 0.15s ease;

  &:hover {
    border-color: rgba(99, 102, 241, 0.3);
  }
}

.installed-icon {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  overflow: hidden;

  span {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    color: #fff;
    font-size: 15px;
    font-weight: 700;
  }
}

.installed-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.installed-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  font-family: ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace;
}

.installed-sub {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted);
}

.installed-desc {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.5;
}

.installed-foot {
  flex: 0 0 auto;
}

.installed-raw {
  margin-top: 6px;
  background: var(--surface);
  border-radius: 10px;
  border: 1px solid var(--border);
  padding: 8px 14px;
  font-size: 12px;
  color: var(--text-body);

  summary {
    cursor: pointer;
    font-weight: 600;
    color: #6366f1;
    padding: 4px 0;
  }

  pre {
    margin: 8px 0 0;
    padding: 10px 12px;
    background: var(--code-bg);
    border-radius: 6px;
    font-family: ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace;
    font-size: 11px;
    color: var(--text-body);
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 280px;
    overflow-y: auto;
  }
}

/* ===== 备份与恢复 placeholder ===== */
.placeholder-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  background: var(--surface);
  border-radius: 12px;
  border: 1px dashed rgba(99, 102, 241, 0.25);
  text-align: center;
}

.placeholder-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}

.placeholder-sub {
  font-size: 13px;
  color: var(--text-muted);
}

.placeholder-tag {
  margin-top: 8px;
  font-size: 11px;
  font-weight: 600;
  color: #6366f1;
  background: var(--code-bg);
  padding: 4px 10px;
  border-radius: 999px;
}

/* ===== 备份与恢复 ===== */
.backup-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.backup-card {
  background: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border);
  box-shadow: 0 2px 8px var(--shadow);
  padding: 14px 16px;
}

.backup-card-head {
  margin-bottom: 12px;
}

.backup-card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.backup-card-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}

.backup-form-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.backup-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
}

.backup-hint {
  margin: 6px 0;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.5;
  padding: 6px 10px;
  background: var(--code-bg);
  border-radius: 6px;
}

.backup-sync-form {
  padding-top: 4px;
}

.backup-export-preview {
  margin-top: 10px;
  border-top: 1px dashed rgba(99, 102, 241, 0.15);
  padding-top: 8px;
}

.backup-export-preview details summary {
  cursor: pointer;
  font-size: 12px;
  color: var(--text-muted);
  padding: 4px 0;
}

.backup-export-preview pre {
  margin: 8px 0 0;
  padding: 10px;
  background: var(--code-bg);
  border-radius: 6px;
  font-size: 11px;
  line-height: 1.5;
  max-height: 240px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.backup-import-result {
  margin-top: 8px;
}

/* ===== 诊断 ===== */
.diagnostic-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border);
  box-shadow: 0 2px 8px var(--shadow);
}

.diagnostic-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.diag-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.diag-sub {
  font-size: 12px;
  color: var(--text-muted);
}

/* ===== 常用命令预设 ===== */
.preset-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 2px 2px 0;
}

.preset-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
}

.preset-chip {
  border: 1px solid rgba(99, 102, 241, 0.15);
  background: var(--chip-bg);
  color: #4338ca;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace;

  &:hover:not(:disabled) {
    border-color: rgba(99, 102, 241, 0.4);
    background: var(--code-bg);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.command-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border);
  box-shadow: 0 2px 8px var(--shadow);
  padding: 12px 14px;
}

.command-input {
  width: 100%;
  font-family: ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace;
}

.command-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.installer-hint {
  font-size: 12px;
  color: #d97706;
  background: #fef3c7;
  padding: 6px 10px;
  border-radius: 6px;
}

.plugin-log {
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  overflow: hidden;
  background: #0f172a;
}

.log-header {
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  color: #cbd5e1;
  background: #1e293b;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.log-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
  font-family: ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  max-height: 360px;
  min-height: 220px;
}

.log-empty {
  color: #64748b;
  font-style: italic;
}

.log-line {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  color: #e2e8f0;
  word-break: break-all;
}

.log-time {
  color: #64748b;
  flex-shrink: 0;
  font-size: 11px;
}

.log-level {
  color: #94a3b8;
  flex-shrink: 0;
  font-size: 11px;
  min-width: 50px;
}

.log-text {
  white-space: pre-wrap;
  word-break: break-all;
  flex: 1;
}

.log-info .log-text { color: #93c5fd; }
.log-success .log-text { color: #6ee7b7; }
.log-error .log-text { color: #fca5a5; }
.log-stderr .log-text { color: #fcd34d; }
.log-stdout .log-text { color: #cbd5e1; }

/* ===== 源管理弹窗 ===== */
.source-modal-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.source-list-head {
  display: flex;
  justify-content: flex-end;
}

.source-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  flex-wrap: wrap;

  &:last-child {
    border-bottom: none;
  }
}

.src-field {
  flex: 1;
  min-width: 120px;
}

.src-name {
  max-width: 140px;
}

.src-default {
  flex-shrink: 0;
  font-size: 12px;
  white-space: nowrap;
}

.source-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.uninstall-confirm-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.uninstall-confirm-text {
  font-size: 13px;
  color: var(--text-body);
  line-height: 1.6;
  word-break: break-word;
}

.uninstall-confirm-tip {
  font-size: 12px;
  color: #d97706;
  background: #fffbeb;
  border: 1px solid rgba(245, 158, 11, 0.25);
  padding: 8px 10px;
  border-radius: 8px;
}

.uninstall-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
