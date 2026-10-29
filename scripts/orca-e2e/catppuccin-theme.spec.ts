import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Page } from '@stablyai/playwright-test'
import { expect, test } from './helpers/orca-app'
import { disablePluginSystem, editorTokenColor, enableDevPlugins, openRepoFile } from './helpers/plugin-smoke'

const PLUGIN = process.env.CATPPUCCIN_PLUGIN_DIR as string
const SHOTS = process.env.CATPPUCCIN_SHOTS_DIR as string
const KEY = 'vale-c.catppuccin'
const FLAVORS = [
  { id: 'catppuccin-mocha', title: 'Catppuccin Mocha', base: 'dark' },
  { id: 'catppuccin-macchiato', title: 'Catppuccin Macchiato', base: 'dark' },
  { id: 'catppuccin-frappe', title: 'Catppuccin Frappé', base: 'dark' },
  { id: 'catppuccin-latte', title: 'Catppuccin Latte', base: 'light' }
] as const
const CODE_FILE = 'palette.ts'
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
    await writeFile(join(seededRepoPath, CODE_FILE), CODE)

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
      await openRepoFile(orcaPage, seededRepoPath, CODE_FILE)
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
    await rm(join(seededRepoPath, CODE_FILE), { force: true })
  }
})
