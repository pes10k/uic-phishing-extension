BUILD_DIR = build

ASSETS_DIR = assets
CHROME_ASSETS_DIR = ${ASSETS_DIR}/chrome
FF_ASSETS_DIR = ${ASSETS_DIR}/firefox
GENERAL_ASSETS_DIR = ${ASSETS_DIR}/general
JS_ASSETS = ${GENERAL_ASSETS_DIR}/js/UIC

FF_BUILD_DIR = ${BUILD_DIR}/uic-phishing-ff-extension
CHROME_BUILD_DIR = ${BUILD_DIR}/uic-phishing-chrome-extension

chrome : clean prepare
	mkdir -p ${CHROME_BUILD_DIR}/js
	cp -Rv ${CHROME_ASSETS_DIR}/* ${CHROME_BUILD_DIR}
	cp -Rv ${GENERAL_ASSETS_DIR}/css ${CHROME_BUILD_DIR}/css
	cp -Rv ${GENERAL_ASSETS_DIR}/js/contrib ${CHROME_BUILD_DIR}/js/contrib

	# Copy Chrome specific JS platform code
	mkdir -p ${CHROME_BUILD_DIR}/js/UIC/platforms/chrome
	cp -Rv ${JS_ASSETS}/platforms/chrome ${CHROME_BUILD_DIR}/js/UIC/platforms

	# Also copy over Chrome specific extension code (those that interact with pages in the Chrome extension model)
	cp -Rv ${JS_ASSETS}/pages ${CHROME_BUILD_DIR}/js/UIC

	# Last, copy over some common items
	cp ${GENERAL_ASSETS_DIR}/js/UIC.js ${CHROME_BUILD_DIR}/js/UIC.js
	cp ${JS_ASSETS}/constants.js ${CHROME_BUILD_DIR}/js/UIC/constants.js
	cp -Rv ${JS_ASSETS}/pages ${CHROME_BUILD_DIR}/js/UIC
	cp -Rv ${JS_ASSETS}/models ${CHROME_BUILD_DIR}/js/UIC

chrome-debug : chrome
	cat ${CHROME_BUILD_DIR}/js/UIC/constants.js | sed 's/ns\.debug = false/ns\.debug = true/' > /tmp/constants.tmp.js
	mv /tmp/constants.tmp.js ${CHROME_BUILD_DIR}/js/UIC/constants.js

ff : clean prepare
	mkdir -p ${FF_BUILD_DIR}/js
	cp -Rv ${FF_ASSETS_DIR}/* ${FF_BUILD_DIR}
	cp -Rv ${GENERAL_ASSETS_DIR}/css ${FF_BUILD_DIR}/css

	zip ${BUILD_DIR}/uic-phishing-ff-extension.xpi ${FF_ASSETS_DIR}
	rm -Rf ${FF_BUILD_DIR}

prepare :
	mkdir ${BUILD_DIR}

clean :
	rm -Rvf ${BUILD_DIR}
