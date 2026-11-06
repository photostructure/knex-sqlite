# Every PhotoStructure repo exposes `make preflight`: run everything that should
# pass before cutting a release -- update dependencies, test against the newest
# and the oldest supported @photostructure/sqlite, then restore the lockfile's
# install. The steps themselves are defined in package.json.
.PHONY: preflight

preflight:
	npm run preflight
