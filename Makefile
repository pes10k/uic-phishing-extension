BUILD_DIR = output
EXT_INFO_FILE = src/common/extension_info.json
EXT_INFO_FILE_TMP = src/common/extension_info.json.tmp
CONST_FILE = src/common/js/UIC/constants.js
TMP_CONSTANTS = constants.js.tmp

debug : DEBUG = true
debug : EXT_NAME = debug
debug : KANGO_FLAGS =
debug : flag all restore
	# Unpacking chrome development version
	@mkdir ${BUILD_DIR}/chrome-unpacked
	@dd if=`ls ${BUILD_DIR}/*.crx` of=/tmp/uic-extension.zip bs=1 skip=306 2> /dev/null
	@unzip -qq /tmp/uic-extension.zip -d ${BUILD_DIR}/chrome-unpacked
	@rm /tmp/uic-extension.zip

release : DEBUG = false
release : EXT_NAME = release
release : KANGO_FLAGS =
release : flag pack all restore

flag :
	# Creating copy of constants file ${CONST_FILE} -> ${TMP_CONSTANTS}
	@cp ${CONST_FILE} ${TMP_CONSTANTS}
	@sed -i '' -E 's/ns\.debug = (false|true);/ns.debug = ${DEBUG};/' ${CONST_FILE}

	ifeq (${DEBUG}, false)
		# If we're in release mode, also strip the browser button out of the
		# build, since this exposes functionality we don't want end users
		# to see
		@cp ${EXT_INFO_FILE} ${EXT_INFO_FILE_TMP}
		@sed -i '' -E 's/"browser_button":.*//' ${EXT_INFO_FILE}
	endif

pack :
	# Compressing and packing javascript for release
	@for JS in `find src -name "*.js" | grep -v contrib`; do \
		TMPDIR=tmp/`dirname $$JS`; \
		if [[ ! -d $$TMPDIR ]]; then \
			mkdir -p $$TMPDIR; \
		fi; \
		cp $$JS tmp/$$JS; \
		echo $$JS | node bin/pack.js > $$JS.packed; \
		mv $$JS.packed $$JS; \
	done

restore :
	# Restoring the build dir to be all unpacked versions of javascript
	@for SOURCE in `find tmp -name "*.js"`; do \
		mv $$SOURCE `echo $$SOURCE | sed -E 's/^tmp\///g'`; \
	done; \
	rm -Rf tmp;

	# Restoring the build tree to its previous state
	@mv ${TMP_CONSTANTS} ${CONST_FILE}

	ifeq (${DEBUG}, false)
		@mv ${EXT_INFO_FILE_TMP} ${EXT_INFO_FILE}
	endif

all : clean

	# Building kango extension
	@python kango/kango.py build ${KANGO_FLAGS} . > /dev/null

	# Cleaning unused files from output dir
	@ls ${BUILD_DIR} | grep -vE ".(crx|xpi)" | xargs -I {} rm -Rf ${BUILD_DIR}/{}

	# Renameing built extensions to match debug / release settings
	@for A_FILE in `ls ${BUILD_DIR}`; do \
		mv ${BUILD_DIR}/$$A_FILE ${BUILD_DIR}/`echo $$A_FILE | sed -E 's/\.(crx|xpi)/_${EXT_NAME}.\1/'`; \
	done

clean :
	# Cleaning the build directory
	@rm -Rf ${BUILD_DIR}/*
