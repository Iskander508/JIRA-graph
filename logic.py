#!/usr/bin/env python
# -*- coding: utf-8 -*-

import jira
import graph
import gitGraph
import git
    
class LogicError(Exception):
    def __init__(self, value):
        self.value = value
    def __str__(self):
        return repr(self.value)


class Logic:
    def __init__(self, config={
                                'jira': {
                                    'url': 'https://jira.atlassian.com',
                                    'auth': None
                                    },
                                'git': {
                                    'repository': 'C:\\git',
                                    'repositoryName': 'avg'
                                    }
                              }):
        self.jira = jira.JIRA(url=config['jira']['url'], auth=config['jira']['auth'])
        self.config = config
        
    def createGraph(self, jiraProjectId, filePath, masterBranches=[]):
        
        issues = self.parseActiveSprintIssues(jiraProjectId)
        
        codeIdMap = {}
        branches = {}
        for id, data in issues.items():
            codeIdMap[data['code']] = id
            if 'branches' in data:
                for branch in data['branches']:
                    if branch['repository'] == self.config['git']['repositoryName']:
                        branches[branch['name']] = False
        
        for branch in masterBranches:
            branches[branch] = True
            
          
        g = graph.Graph()
        gitRepository = git.GIT(self.config['git']['repository'])
        
        for branch in self.calculateBranches(branches):
            branch.update({'type': 'branch' if (len(branch['branchNames']) != 0) else 'commit'})
            # TODO Add stash URL
            nodeId = self.getGitNodeId(branch['id'])
            g.addNode(graph.Node(nodeId, graph.Node.Type.GIT, branch))
            for successor in branch['successors']:
                g.addEdge(graph.Edge(nodeId, self.getGitNodeId(successor), gitRepository.getDistance(branch['id'], successor)))
        
        for id, data in issues.items():
            if data['statusColor'] == 'blue-gray':
                data['statusColor'] = 'gray'
            if data['statusColor'] == 'yellow':
                data['statusColor'] = 'orange'
                
            g.addNode(graph.Node(self.getIssueNodeId(id), graph.Node.Type.JIRA, data))
            
            if 'branches' in data:
                linkedBranches = set()
                for branch in data['branches']:
                    gitId = gitRepository.revParse('origin/' + branch['name'])
                    nodeId = self.getGitNodeId(gitId)
                    if gitId not in linkedBranches:
                        g.addEdge(graph.Edge(self.getIssueNodeId(id), nodeId))
                        linkedBranches.add(gitId)
            
            if 'subtasks' in data:
                for code in data['subtasks']:
                    if code in codeIdMap:
                        g.addEdge(graph.Edge(self.getIssueNodeId(id), self.getIssueNodeId(codeIdMap[code]), 'subtask'))
        
            if 'links' in data:
                for link in data['links']:
                    if link['key'] in codeIdMap:
                        g.addEdge(graph.Edge(self.getIssueNodeId(id), self.getIssueNodeId(codeIdMap[link['key']]), link['type']))
                        
            if 'pullRequests' in data:
                for pullRequest in data['pullRequests']:
                    if (pullRequest['status'] != 'MERGED') and (pullRequest['status'] != 'DECLINED'):
                        pullRequestId = self.getPullRequestNodeId(pullRequest['id'])
                        if not g.hasNode(pullRequestId):
                            g.addNode(graph.Node(pullRequestId, graph.Node.Type.STASH, pullRequest))
                            
                            # Add links to source and target branch
                            if pullRequest['repository'] == self.config['git']['repositoryName']:
                                sourceGitId = gitRepository.revParse('origin/' + pullRequest['source'])
                                targetGitId = gitRepository.revParse('origin/' + pullRequest['destination'])
                                sourceNodeId = self.getGitNodeId(sourceGitId)
                                targetNodeId = self.getGitNodeId(targetGitId)
                                if g.hasNode(sourceNodeId):
                                    g.addEdge(graph.Edge(sourceNodeId, pullRequestId))
                                if g.hasNode(targetNodeId):
                                    g.addEdge(graph.Edge(pullRequestId, targetNodeId))
                                
                        g.addEdge(graph.Edge(self.getIssueNodeId(id), pullRequestId))
                        
        g.saveGraphJson(filePath)
        
    def calculateBranches(self, branches):
        gitRepository = git.GIT(self.config['git']['repository'])
        
        gitRepository.reset()
        gitRepository.fetch()
        
        g = gitGraph.GitGraph(gitRepository)
        
        masterIds = set()
        for name, master in branches.items():
            remoteName = 'origin/' + name
            g.add(remoteName)
            if master:
                masterIds.add(gitRepository.revParse(remoteName))
          
        result = []
        for id in g.getIds():
            branchNames = []
            masterBranch = (id in masterIds)
            for branch in gitRepository.getBranches(id):
                branchNames.append(branch.name)
            
            inMaster = (not masterBranch
                        and g.getPredecessors(id, direct=False).isdisjoint(masterIds)
                        and not g.getSuccessors(id, direct=False).isdisjoint(masterIds)
                        )
            
            result.append({
                            'id': id,
                            'master': masterBranch,
                            'branchNames': branchNames,
                            'inMaster': inMaster,
                            'successors': g.getSuccessors(id)
                        })
                        
        return result
        
    def parseActiveSprintIssues(self, jiraProjectId):
        issues = {}
        for majorIssueData in self.getActiveSprintsIssues(jiraProjectId):
            issueData = self.jira.getIssue(majorIssueData['key'])
            issue = self.parseIssue(issueData)
            
            issue['done'] = majorIssueData['done']
            
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
            
        issue.update(self.parseIssueDetails(self.jira.getIssueDetails(issueData['id'])))
            
        return issue
        
    def parseIssueDetails(self, issueDetails):
        branches = []
        pullRequests = []
        for detail in issueDetails['detail']:
            for branch in detail['branches']:
                branches.append({
                    'name': branch['name'],
                    'URL': branch['url'],
                    'repository': branch['repository']['name']
                    })
                    
            for pullRequest in detail['pullRequests']:
                reviewers = []
                for reviewer in pullRequest['reviewers']:
                    reviewers.append({
                        'name': reviewer['name'],
                        'approved': reviewer['approved']
                        })
            
                pullRequests.append({
                    'id': pullRequest['id'],
                    'name': pullRequest['name'],
                    'source': pullRequest['source']['branch'],
                    'destination': pullRequest['destination']['branch'],
                    'repository': pullRequest['source']['repository']['name'],
                    'URL': pullRequest['url'],
                    'status': pullRequest['status'],
                    'reviewers': reviewers
                    })

        details = {}
        if len(branches) != 0:
            details['branches'] = branches
            
        if len(pullRequests) != 0:
            details['pullRequests'] = pullRequests
            
        return details
        
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
        return links

    def getActiveSprintsIssues(self, jiraProjectId):
        activeSprints = self.getActiveSprints(jiraProjectId)
        if len(activeSprints) == 0:
            raise LogicError('No active sprints')
        
        issues = []
        for id, name in activeSprints.items():
            board = self.jira.getAgileBoard(jiraProjectId, id)
            for key, value in board['contents'].items():
                if ('Issues' in key) and (type(value) is list):
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
        return self.config['jira']['url'] + '/browse/' + issueCode
        
    def getIssueNodeId(self, issueId):
        return 'issue_' + str(issueId)
        
    def getPullRequestNodeId(self, pullRequestId):
        return 'pullRequest_' + str(pullRequestId).replace('#','')
        
    def getGitNodeId(self, gitId):
        return 'git_' + str(gitId).replace('/','_').replace('@','_').replace('-','_')