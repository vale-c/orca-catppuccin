import { execFileSync } from 'node:child_process'
import { mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Page } from '@stablyai/playwright-test'
import { expect, test } from './helpers/orca-app'
import { disablePluginSystem, editorTokenColor, enableDevPlugins, openRepoFile } from './helpers/plugin-smoke'

const PLUGIN = process.env.CATPPUCCIN_PLUGIN_DIR as string
const SHOTS = process.env.CATPPUCCIN_SHOTS_DIR as string
const DEMO_ROOT = process.env.CATPPUCCIN_DEMO_DIR as string
const KEY = 'vale-c.catppuccin'
const FLAVORS = [
  { id: 'catppuccin-mocha', title: 'Catppuccin Mocha', base: 'dark' },
  { id: 'catppuccin-macchiato', title: 'Catppuccin Macchiato', base: 'dark' },
  { id: 'catppuccin-frappe', title: 'Catppuccin Frappé', base: 'dark' },
  { id: 'catppuccin-latte', title: 'Catppuccin Latte', base: 'light' }
] as const
const CODE_FILE = 'src/palette.ts'
const CODE = `// Resolve the palette for the active workspace.
import { createTheme } from './theme'

export interface Workspace {
  name: string
  tabs: number
}

export function openWorkspace(ws: Workspace) {
  const theme = createTheme({ contrast: 0.92, accent: 'mauve' })
  if (ws.tabs > 12) return theme.compact()
  return { ...theme, title: ws.name }
}
`


const DEMO_FILES: Record<string, string> = {
  'package.json': '{ "name": "atlas", "private": true }\n',
  'README.md': '# atlas\n',
  'tsconfig.json': '{ "compilerOptions": { "strict": true } }\n',
  'src/theme.ts': 'export const createTheme = (options: object) => ({ ...options })\n',
  [CODE_FILE]: CODE
}

/** A clean project named atlas, added and opened the way a user would, replacing the fixture repo. */
async function openDemoProject(page: Page, fixtureRepoPath: string): Promise<string> {
  const dir = join(DEMO_ROOT, 'atlas')
  await rm(dir, { recursive: true, force: true })
  for (const [name, text] of Object.entries(DEMO_FILES)) {
    await mkdir(join(dir, name, '..'), { recursive: true })
    await writeFile(join(dir, name), text)
  }
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' })
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('-c', 'user.name=atlas', '-c', 'user.email=atlas@example.com', 'commit', '-qm', 'init')
  const repoPath = await realpath(dir)
  await page.evaluate(
    async ({ repoPath, fixtureRepoPath }) => {
      const added = await window.api.repos.add({ path: repoPath })
      if ('error' in added) {
        throw new Error(added.error)
      }
      const store = window.__store!
      await store.getState().fetchRepos({ runtimeEnvironmentId: null, throwOnError: true })
      const fixture = store.getState().repos.find((repo) => repo.path === fixtureRepoPath)
      if (fixture) {
        await store.getState().removeProject(fixture.id, { hostId: fixture.executionHostId ?? 'local', errorFeedback: 'silent' })
      }
    },
    { repoPath, fixtureRepoPath }
  )
  await expect
    .poll(
      () =>
        page.evaluate(async (repoPath) => {
          const store = window.__store!
          const repo = store.getState().repos.find((entry) => entry.path === repoPath)
          if (!repo) {
            return null
          }
          await store.getState().fetchWorktrees(repo.id)
          const worktree = (store.getState().worktreesByRepo[repo.id] ?? [])[0]
          if (worktree) {
            store.getState().setActiveWorktree(worktree.id)
          }
          return store.getState().activeWorktreeId === worktree?.id ? worktree.id : null
        }, repoPath),
      { timeout: 15_000, message: 'the atlas project never became the active workspace' }
    )
    .not.toBeNull()
  return repoPath
}

const rgb = (hex: string): string =>
  `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`
const css = (page: Page, token: string): Promise<string> =>
  page.evaluate((name) => document.documentElement.style.getPropertyValue(name), token)

async function openSettings(page: Page, pane: string, section: string): Promise<void> {
  await page.evaluate((target) => {
    const state = window.__store?.getState()
    state?.openSettingsTarget({ pane: target, repoId: null })
    state?.openSettingsPage()
  }, pane)
  await expect(page.locator(`[data-settings-section="${section}"]`)).toBeVisible()
}

async function choose(page: Page, select: string, option: string): Promise<void> {
  await page.getByRole('combobox', { name: select, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

test('Catppuccin flavors load and switch', async ({ orcaPage, seededRepoPath }) => {
  test.setTimeout(240_000)
  try {
    await enableDevPlugins(orcaPage, [PLUGIN])
    const plugin = await orcaPage.evaluate(
      async (key) => (await window.api.plugins.refresh()).find((p) => p.pluginKey === key),
      KEY
    )
    expect(['idle', 'enabled'], JSON.stringify(plugin)).toContain(plugin?.status)
    const demoPath = await openDemoProject(orcaPage, await realpath(seededRepoPath))

    for (const flavor of FLAVORS) {
      const theme = JSON.parse(await readFile(join(PLUGIN, 'themes', `${flavor.id}.json`), 'utf8'))
      const terminal = JSON.parse(await readFile(join(PLUGIN, 'terminal', `${flavor.id}.json`), 'utf8'))
      await openSettings(orcaPage, 'appearance', 'appearance')
      await orcaPage
        .getByRole('radiogroup', { name: 'Theme', exact: true })
        .getByRole('radio', { name: flavor.base === 'dark' ? 'Dark' : 'Light', exact: true })
        .click()
      await choose(orcaPage, flavor.base === 'dark' ? 'Dark theme' : 'Light theme', flavor.title)
      for (const token of Object.keys(theme.tokens)) {
        await expect.poll(() => css(orcaPage, token), { message: `${flavor.id} ${token}` }).toBe(theme.tokens[token])
      }

      await orcaPage.evaluate(
        async ({ id, base, colors }) => {
          const settings = await window.api.settings.set({
            [base === 'dark' ? 'terminalThemeDark' : 'terminalThemeLight']: `plugin:${id}`,
            terminalUseSeparateLightTheme: true,
            terminalPluginPalettes: [{ id: `plugin:${id}`, colors }]
          })
          window.__store?.setState({ settings })
        },
        { id: `${KEY}/${flavor.id}`, base: flavor.base, colors: terminal.terminal }
      )

      await orcaPage.evaluate(() => window.__store?.getState().closeSettingsPage())
      await openRepoFile(orcaPage, demoPath, CODE_FILE)
      const color = (name: string): string =>
        rgb(theme.tokenColors.find((rule: { name: string }) => rule.name === name).settings.foreground)
      await expect.poll(() => editorTokenColor(orcaPage, 'export'), { timeout: 15_000 }).toBe(color('Keywords'))
      await expect.poll(() => editorTokenColor(orcaPage, '// Resolve the palette for the active workspace.')).toBe(color('Comments'))
      await expect.poll(() => editorTokenColor(orcaPage, "'mauve'")).toBe(color('Strings'))
      await expect.poll(() => editorTokenColor(orcaPage, '0.92')).toBe(color('Numbers'))
      await orcaPage.evaluate(() => {
        const state = window.__store?.getState()
        state?.showRightSidebarFiles()
        state?.setRightSidebarOpen(true)
      })
      await orcaPage.waitForTimeout(800)
      await orcaPage.screenshot({ path: join(SHOTS, `${flavor.id}.png`) })
    }
  } finally {
    await disablePluginSystem(orcaPage).catch(() => undefined)
    await rm(join(DEMO_ROOT, 'atlas'), { recursive: true, force: true })
  }
})
