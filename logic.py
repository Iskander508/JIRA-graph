#!/usr/bin/env python
# -*- coding: utf-8 -*-

import jira
    
class LogicError(Exception):
    def __init__(self, value):
        self.value = value
    def __str__(self):
        return repr(self.value)


class Logic:
    def __init__(self, jiraUrl='https://jira.atlassian.com', jiraAuth=None):
        self.jira = jira.JIRA(url=jiraUrl, auth=jiraAuth)
        self.jiraUrl = jiraUrl
        
    def parseActiveSprintIssues(self, jiraProjectId):
        issues = {}
        for majorIssueData in getActiveSprintsIssues(jiraProjectId):
            issueData = self.jira.getIssue(majorIssueData['key'])
            issue = self.parseIssue(issueData)
            
            if 'epicField' in majorIssueData:
                issue['epic'] = majorIssueData['epicField']['text']
                issue['epicColor'] = majorIssueData['epicField']['epicColor']
                
            issues[issueData['id']] = issue
            
            if 'subtasks' in issue:
                for subtaskKey in issue['subtasks']:
                    subtaskData = self.jira.getIssue(subtaskKey)
                    issues[subtaskData['id']] = self.parseIssue(subtaskData)
                    
            if 'links' in issue:
                # Parse only linked issues that haven't been parsed yet
                for linkData in issue['links']:
                    found = False
                    for id, data in issues.items():
                        if data['code'] == linkData['key']:
                            found = True
                            break
                    
                    if not found:
                        linkedIssueData = self.jira.getIssue(linkData['key'])
                        issues[linkedIssueData['id']] = self.parseIssue(linkedIssueData)
        
        return issues
        
    def parseIssue(self, issueData):        
        issue = {
            'code': issueData['key'],
            'type': ''.join(issueData['fields']['issuetype']['name'].split()),
            'URL': self.getIssueUrl(issueData['key']),
            'summary': issueData['fields']['summary'],
            'assignee': issueData['fields']['assignee']['displayName'],
            'status': issueData['fields']['status']['name'],
            'statusColor': issueData['fields']['status']['statusCategory']['colorName'],
            'completed': issueData['fields']['progress']['progress']/3600,
            'estimated': issueData['fields']['progress']['total']/3600
            }
            
        if 'avatarUrls' in issueData['fields']['assignee']:
            issue['assigneeImage'] = issueData['fields']['assignee']['avatarUrls']['24x24']
            
        subtasks = self.getIssueSubtasks(issueData)
        if len(subtasks) != 0:
            issue['subtasks'] = subtasks
            
        links = self.getIssueLinks(issueData)
        if len(links) != 0:
            issue['links'] = links
            
        return issue
        
    def getIssueSubtasks(self, issueData):        
        subtasks = []
        for subtask in issueData['fields']['subtasks']:
            subtasks.append(subtask['key'])
            
        return subtasks
        
    def getIssueLinks(self, issueData):        
        links = []
        mainIssueProjectKey = issueData['key'].split('-')[0]
        for link in issueData['fields']['issuelinks']:
            if 'outwardIssue' in link:
                links.append({
                    'key': link['outwardIssue']['key'],
                    'type': link['type']['outward']
                    })
            if 'inwardIssue' in link:
                # Add only inward links that link from another project
                issueProjectKey = issueData['inwardIssue']['key'].split('-')[0]
                if issueProjectKey != mainIssueProjectKey:
                    links.append({
                        'key': link['inwardIssue']['key'],
                        'type': link['type']['inward']
                        })
            
        return links

    def getActiveSprintsIssues(self, jiraProjectId):
        activeSprints = self.getActiveSprints(jiraProjectId)
        if len(activeSprints) == 0:
            raise LogicError('No active sprints')
        
        issues = []
        for id, name in activeSprints.items():
            board = self.jira.getAgileBoard(jiraProjectId, id)
            for key, value in board['contents'].items():
                if 'Issues' in key:
                    issues.extend(value)

        return issues
            
    def getActiveSprints(self, jiraProjectId):
        sprints = self.jira.getSprints(jiraProjectId)
        
        activeSprints = {}
        for sprint in sprints['sprints']:
            if sprint['state'] == 'ACTIVE':
                activeSprints[sprint['id']] = sprint['name']
        
        return activeSprints
            
    def getIssueUrl(self, issueCode):
        return self.jiraUrl + '/browse/' + issueCode