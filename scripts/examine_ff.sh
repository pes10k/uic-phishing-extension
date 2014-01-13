#!/bin/bash

FF_TARGET="uic-phishing-study@uic.edu.xpi"

cd build
mkdir unpacked
mv $FF_TARGET unpacked
cd unpacked
unzip $FF_TARGET
open .
