import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const action = process.argv[2]
const harness = resolve(process.argv[3] ?? '')
const skipBuild = process.argv.includes('--no-build')
const source = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = join(harness, '.doudizhu-local-install.json')
const cordisPath = join(harness, 'packages/bundle/web-app/cordis.patch.yml')
const bundlePackagePath = join(harness, 'packages/bundle/web-app/package.json')
const hostConfigPath = join(harness, 'tsconfig.host.json')
const clientConfigPath = join(harness, 'tsconfig.client.json')
const hostTarget = join(harness, 'packages/game/doudizhu')
const clientTarget = join(harness, 'packages/client/ui-doudizhu')
const markerStart = '# BEGIN doudizhu-local-installer'
const markerEnd = '# END doudizhu-local-installer'

try {
  if (!['install', 'uninstall'].includes(action) || process.argv[3] === undefined || process.argv[3].length === 0) {
    fail('Usage: modify-harness.mjs <install|uninstall> <harness-directory> [--no-build]')
  }
  for (const path of [cordisPath, bundlePackagePath, hostConfigPath, clientConfigPath]) {
    if (!existsSync(path)) fail(`Not a compatible DeepSeek Harness checkout: missing ${path}`)
  }
  if (action === 'install') install()
  else uninstall()
} catch (error) {
  console.error(`doudizhu-local: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}

function install() {
  const reinstall = existsSync(manifestPath)
  if (reinstall) {
    console.log('DouDizhu local plugin is already installed.')
    return
  }
  if (hasExistingIntegration()) fail('A DouDizhu integration already exists but is not managed by this installer; remove it manually first.')

  const originals = snapshot()
  try {
    updateBundlePackage(true)
    updateTsconfig(hostConfigPath, './packages/game/doudizhu', './apps/cli', true)
    updateTsconfig(clientConfigPath, './packages/client/ui-doudizhu', './apps/web', true)
    updateCordis(true)
    replaceDirectory(join(source, 'packages/game/doudizhu'), hostTarget)
    replaceDirectory(join(source, 'packages/client/ui-doudizhu'), clientTarget)
    writeFileSync(manifestPath, `${JSON.stringify({ version: 1, repository: 'zhulin025/deepseek-harness-doudizhu-local' }, null, 2)}\n`)
  } catch (error) {
    restore(originals)
    rmSync(hostTarget, { recursive: true, force: true })
    rmSync(clientTarget, { recursive: true, force: true })
    rmSync(manifestPath, { force: true })
    throw error
  }

  if (!skipBuild) {
    run('pnpm', ['install'])
    run('pnpm', ['run', 'build:lib:host'])
    run('pnpm', ['run', 'build:lib:client'])
  }
  console.log('DouDizhu local plugin installed.')
}

function hasExistingIntegration() {
  return existsSync(hostTarget)
    || existsSync(clientTarget)
    || readFileSync(bundlePackagePath, 'utf8').includes('@deepseek-ai/dsh-doudizhu')
    || readFileSync(bundlePackagePath, 'utf8').includes('@deepseek-ai/dsh-client-ui-doudizhu')
    || readFileSync(hostConfigPath, 'utf8').includes('./packages/game/doudizhu')
    || readFileSync(clientConfigPath, 'utf8').includes('./packages/client/ui-doudizhu')
    || readFileSync(cordisPath, 'utf8').includes(markerStart)
    || /^\s+- id: doudizhu\s*$/m.test(readFileSync(cordisPath, 'utf8'))
}

function uninstall() {
  if (!existsSync(manifestPath)) {
    console.log('DouDizhu local plugin is already absent.')
    return
  }
  updateBundlePackage(false)
  updateTsconfig(hostConfigPath, './packages/game/doudizhu', './apps/cli', false)
  updateTsconfig(clientConfigPath, './packages/client/ui-doudizhu', './apps/web', false)
  updateCordis(false)
  rmSync(hostTarget, { recursive: true, force: true })
  rmSync(clientTarget, { recursive: true, force: true })
  rmSync(manifestPath)
  if (!skipBuild) run('pnpm', ['install'])
  console.log('DouDizhu local plugin uninstalled.')
}

function updateBundlePackage(installing) {
  let text = readFileSync(bundlePackagePath, 'utf8')
  const dependencies = [
    ['@deepseek-ai/dsh-client-ui-doudizhu', 'workspace:^'],
    ['@deepseek-ai/dsh-doudizhu', 'workspace:^'],
  ]
  for (const [name, version] of dependencies) {
    const line = `    "${name}": "${version}",\n`
    if (installing && !text.includes(`"${name}"`)) {
      text = replaceOnce(text, '  "dependencies": {\n', `  "dependencies": {\n${line}`, bundlePackagePath)
    } else if (!installing) {
      text = text.replace(line, '')
    }
  }
  JSON.parse(text)
  writeFileSync(bundlePackagePath, text)
}

function updateTsconfig(path, reference, anchor, installing) {
  let text = readFileSync(path, 'utf8')
  const block = `    // doudizhu-local-installer\n    { "path": "${reference}" },\n`
  if (installing && !text.includes(`"path": "${reference}"`)) {
    text = replaceOnce(text, `    { "path": "${anchor}" }`, `${block}    { "path": "${anchor}" }`, path)
  } else if (!installing) {
    text = text.replace(block, '')
  }
  writeFileSync(path, text)
}

function updateCordis(installing) {
  let text = readFileSync(cordisPath, 'utf8')
  const block = `\n${markerStart}\n- insert:\n    - id: doudizhu\n      name: '@deepseek-ai/dsh-doudizhu'\n      config:\n        localOnly: true\n    - id: client-ui-doudizhu\n      name: '@deepseek-ai/dsh-client-ui-doudizhu'\n${markerEnd}\n`
  if (installing && !text.includes(markerStart)) text += block
  if (!installing) text = text.replace(block, '')
  writeFileSync(cordisPath, text)
}

function replaceDirectory(from, to) {
  rmSync(to, { recursive: true, force: true })
  mkdirSync(dirname(to), { recursive: true })
  cpSync(from, to, { recursive: true, filter: path => !path.split('/').some(part => part === 'node_modules' || part === 'lib') })
}

function snapshot() {
  return new Map([cordisPath, bundlePackagePath, hostConfigPath, clientConfigPath].map(path => [path, readFileSync(path)]))
}

function restore(files) {
  for (const [path, contents] of files) writeFileSync(path, contents)
}

function replaceOnce(text, needle, replacement, path) {
  if (!text.includes(needle)) fail(`Cannot find installation anchor in ${path}`)
  return text.replace(needle, replacement)
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: harness, stdio: 'inherit' })
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) fail(`${command} ${args.join(' ')} failed with exit code ${String(result.status)}`)
}

function fail(message) {
  throw new Error(message)
}
