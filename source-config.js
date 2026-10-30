exports.requireVault = function () {
  if (!process.env.OBSIDIAN_VAULT) throw new Error('Set OBSIDIAN_VAULT to the wiki directory, or set THE100_DIR / PEOPLE_DIR / REGION_DIR. See README.md.');
  return process.env.OBSIDIAN_VAULT;
};
