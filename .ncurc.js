/** @type {import('npm-check-updates').RunOptions} */
module.exports = {
  // devDependencies are pinned exactly; the committed lockfile is what CI and
  // contributor installs resolve against.
  removeRange: true,
  cooldown: 14
}
