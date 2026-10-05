// Cuts a Noma release: bumps the version, commits, and tags it `vX.Y.Z`.
// Pushing that tag is what makes CI build the Windows and macOS installers
// and publish them, and installed copies then update themselves.
//
//   npm run release            -> patch (0.1.0 -> 0.1.1)
//   npm run release -- minor   -> 0.2.0
//   npm run release -- major   -> 1.0.0
//
// Then push (GitHub Desktop: "Push origin", or `git push --follow-tags`).
import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'

const bump = process.argv[2] ?? 'patch'
if (!['patch', 'minor', 'major'].includes(bump)) {
  console.error(`Unknown bump "${bump}". Use patch, minor or major.`)
  process.exit(1)
}

const git = process.env.GIT ?? 'git'
// npm is a .cmd on Windows and needs a shell; git doesn't, and must not get
// one, or the shell splits a commit message like "Noma v0.1.1" in two.
const run = (command, args) =>
  execFileSync(command, args, { stdio: 'inherit', shell: command === 'npm' && process.platform === 'win32' })

const status = execFileSync(git, ['status', '--porcelain'], { encoding: 'utf8' })
if (status.trim()) {
  console.error('Commit or stash your changes first, so the release contains exactly what is committed.')
  process.exit(1)
}

run('npm', ['version', bump, '--no-git-tag-version'])
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const tag = `v${version}`

run(git, ['add', 'package.json', 'package-lock.json'])
run(git, ['commit', '-m', `Noma ${tag}`])
run(git, ['tag', '-a', tag, '-m', `Noma ${tag}`])

console.log(`\nTagged ${tag}. Push it to build and publish Windows + macOS:`)
console.log('  GitHub Desktop: "Push origin"   or   git push --follow-tags')
