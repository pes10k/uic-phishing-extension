#!/bin/bash

FF_BUILD_DIR="build/uic-phishing-ff-extension"
FF_TARGET="uic-phishing-study@uic.edu.xpi"

cd $FF_BUILD_DIR
zip -r $FF_TARGET *
mv $FF_TARGET ../
