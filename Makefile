BUILD_DIR = output
CONST_FILE = src/common/js/UIC/constants.js
TMP_CONSTANTS = constants.js.tmp

debug : DEBUG = true
debug : EXT_NAME = debug
debug : KANGO_FLAGS =
debug : all
	# Unpacking chrome development version
	@mkdir ${BUILD_DIR}/chrome-unpacked
	@dd if=`ls ${BUILD_DIR}/*.crx` of=/tmp/uic-extension.zip bs=1 skip=306 2> /dev/null
	@unzip -qq /tmp/uic-extension.zip -d ${BUILD_DIR}/chrome-unpacked
	@rm /tmp/uic-extension.zip

release : DEBUG = false
release : EXT_NAME = release
release : KANGO_FLAGS =
release : pack all restore

pack :
	@for JS in `find src -name "*.js" | grep -v contrib`; do \
		cp $$JS $$JS.unpacked; \
		echo $$JS | node bin/pack.js > $$JS.packed; \
		mv $$JS.packed $$JS; \
	done

restore :
	# Restoring the build dir to be all unpacked versions of javascript
	@find . -name "*.js.unpacked" | sed -E 's/\.unpacked//g' | xargs -J % cp %.unpacked %
	@find . -name "*.js.unpacked" -exec rm {} \;

all : clean
	# Creating copy of constants file ${CONST_FILE} -> ${TMP_CONSTANTS}
	@cp ${CONST_FILE} ${TMP_CONSTANTS}
	@sed -i '' -E 's/ns\.debug = (false|true);/ns.debug = ${DEBUG};/' ${CONST_FILE}

	# Building kango extension
	@python kango/kango.py build ${KANGO_FLAGS} . > /dev/null

	# Cleaning unused files from output dir
	@ls ${BUILD_DIR} | grep -vE ".(crx|xpi)" | xargs -I {} rm -Rf ${BUILD_DIR}/{}

	# Renameing built extensions to match debug / release settings
	@for A_FILE in `ls ${BUILD_DIR}`; do \
		mv ${BUILD_DIR}/$$A_FILE ${BUILD_DIR}/`echo $$A_FILE | sed -E 's/\.(crx|xpi)/_${EXT_NAME}.\1/'`; \
	done

	# Restoring the build tree to its previous state
	@mv ${TMP_CONSTANTS} ${CONST_FILE}

clean :
	# Cleaning the build directory
	@rm -Rf ${BUILD_DIR}/*

