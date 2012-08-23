test:
	@./node_modules/.bin/mocha \
		--reporter spec \
		--bail \
		--require ./test/common.js

.PHONY: test
