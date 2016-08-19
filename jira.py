#!/usr/bin/env python
# -*- coding: utf-8 -*-

import requests
import json

class JIRA:
    def __init__(self, url='https://jira.atlassian.com', auth=None):
        self.url = url
        self.auth = auth
        requests.packages.urllib3.disable_warnings()

    def getSprints(self, projectId):
        return self.get('/rest/greenhopper/latest/sprintquery/{0}'.format(projectId))
        
    def getAgileBoard(self, projectId, sprintId):
        return self.get('/rest/greenhopper/latest/rapid/charts/sprintreport?rapidViewId={0}&sprintId={1}'.format(projectId, sprintId))

    def getBoard(self, boardId, issueFields):
        return self.get('/rest/agile/latest/board/{0}/issue?fields={1}'.format(boardId, issueFields))
    
    def getIssue(self, issueId):
        return self.get('/rest/api/2/issue/{0}?fields=issuelinks,assignee,subtasks,progress,issuetype,summary,priority,status'.format(issueId))
    
    def getIssueDetails(self, issueId):
        return self.get('/rest/dev-status/latest/issue/detail?issueId={0}&applicationType=stash&dataType=pullrequest'.format(issueId))
    
    class JIRAError(Exception):
        def __init__(self, status_code, text):
            self.status_code = status_code
            self.text = text
        def __str__(self):
            return str(self.status_code) + ': ' + self.text

    def get(self, uri):
        response = requests.get(self.url + uri, verify=False, auth=self.auth)
        if response.status_code != 200:
            raise self.JIRAError(response.status_code, response.text)
            
        return json.loads(response.text)