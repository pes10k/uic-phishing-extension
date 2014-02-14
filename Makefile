BUILD_DIR = output
CONST_FILE = src/common/js/UIC/constants.js
TMP_CONSTANTS = constants.js.tmp

ifeq (${.TARGET}, "debug")
	DEBUG = true
	EXT_NAME = debug
else
	DEBUG = false
	EXT_NAME = release
endif

debug : DEBUG = true
debug : EXT_NAME = debug
debug : all

release : DEBUG = false
release : EXT_NAME = release
release : all

all : clean
	# Creating copy of constants file ${CONST_FILE} -> ${TMP_CONSTANTS}
	@cp ${CONST_FILE} ${TMP_CONSTANTS}
	@sed -i '' -E 's/ns\.debug = (false|true);/ns.debug = ${DEBUG};/' ${CONST_FILE}

	# Building kango extension
	@ python kango/kango.py build . > /dev/null

	# Cleaning unused files from output dir
	@ ls ${BUILD_DIR} | grep -vE ".(crx|xpi)" | xargs -I {} rm -Rf ${BUILD_DIR}/{}

	# Renameing built extensions to match debug / release settings
	@for A_FILE in `ls ${BUILD_DIR}`; do \
		mv ${BUILD_DIR}/$$A_FILE ${BUILD_DIR}/`echo $$A_FILE | sed -E 's/\.(crx|xpi)/_${EXT_NAME}.\1/'`; \
	done

	# Restoring the build tree to its previous state
	@mv ${TMP_CONSTANTS} ${CONST_FILE}

clean :
	# Cleaning the build directory
	@rm -Rf ${BUILD_DIR}/*

