﻿#!/usr/bin/env python
# -*- coding: utf-8 -*-

import logic
import datetime
import time
import os
import shutil
import sys
from distutils import dir_util

destinationOutDir = sys.argv[1]

startTimes = [
    "07:00",
    "08:30",
    "09:30",
    "10:30",
    "11:30",
    "12:30",
    "13:30",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "17:00",
    "18:00"
    ]

logicConfig = {
        'jira': {
            'url': 'https://jira.atlassian.com',
            'auth': None
            },
        'git': {
            'repository': 'C:\\git',
            'repositoryName': 'avg'
            },
        'stash': {
            'url': 'https://stash.atlassian.com/commit/'
            }
      }
      
def getMinute(startTime):
    return int(startTime[-2:])
    
def getHour(startTime):
    return int(startTime[:2])
    
def runLogic():
    tmpDir = 'tmp_out'
    if os.path.exists(tmpDir):
        shutil.rmtree(tmpDir, ignore_errors=True)
    os.makedirs(tmpDir)
            
    l = logic.Logic(logicConfig)
    l.createGraph(588, tmpDir + '/data.json', masterBranches=['zaap/devel'], additionalBranches=[])
    
    dir_util.copy_tree(tmpDir, destinationOutDir, update=True)
    
runLogic()
while True:
    now = datetime.datetime.now()
    
    nextStartTime = "24:00"
    perform = False
    
    if now.weekday() < 5: # work-days only
        for startTime in startTimes:
            if (now.hour < getHour(startTime)) or ((now.hour == getHour(startTime)) and (now.minute < getMinute(startTime))):
                nextStartTime = startTime
                perform = True
                break
            
    print("Next run in " + nextStartTime)

    minutesToWait = 60*(getHour(nextStartTime) - now.hour) + (getMinute(nextStartTime) - now.minute)
    if minutesToWait > 0:
        time.sleep(minutesToWait * 60)
    
    if not perform:
        continue
        
    print("Performing at " + nextStartTime)
    try:
        runLogic()
    except:
        pass
    
