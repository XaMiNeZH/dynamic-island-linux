UUID := dynamic-island@xaminezh.xyz
SRC := src
ZIP := $(UUID).shell-extension.zip

.PHONY: all check schemas test zip install uninstall clean

all: check zip

schemas:
	glib-compile-schemas $(SRC)/schemas

test:
	gjs --module tests/test-activity-stack.js
	gjs --module tests/test-motion.js
	gjs --module tests/test-clock-format.js

check: schemas test
	python3 -c "import json; json.load(open('$(SRC)/metadata.json'))"
	test -f $(SRC)/extension.js
	test -f $(SRC)/prefs.js
	test -f $(SRC)/stylesheet.css
	test -f $(SRC)/schemas/gschemas.compiled

zip: schemas
	rm -f $(ZIP)
	cd $(SRC) && zip -r ../$(ZIP) . \
		-x 'schemas/*~' \
		-x '*.orig'

install: schemas
	./install.sh

uninstall:
	./uninstall.sh

clean:
	rm -f $(ZIP) $(SRC)/schemas/gschemas.compiled
