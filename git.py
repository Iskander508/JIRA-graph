#!/usr/bin/env python
# -*- coding: utf-8 -*-

import subprocess

class Branch:
    def __init__(self, name, remote=True):
        self.name = name
        self.remote = remote
        
    def __repr__(self):
        return 'Branch' + str({
            'name': self.name,
            'remote': self.remote
            })

class GIT:
    def __init__(self, repositoryPath, gitExecutable='git.exe'):
        self.repositoryPath = repositoryPath
        self.gitExecutable = gitExecutable

    def fetch(self):
        return self.runGit('fetch')
        
    def status(self, short=True):
        params = ['status']
        if short:
            params.append('--short')
        return self.runGit(params)
        
    def checkout(self, id, updateSubmodules=True):
        self.runGit(['checkout', self.parseId(id)])
        if updateSubmodules:
            return self.runGit(['submodule', '--update', '--init', '--recursive'])
        
    def merge(self, id):
        return self.runGit(['merge', self.parseId(id)])
        
    def revParse(self, id):
        return self.runGit(['rev-parse', self.parseId(id)])
        
    def mergeBase(self, id1, id2):
        return self.runGit(['merge-base', self.parseId(id1), self.parseId(id2)])
        
    def getDistance(self, olderId, newerId):
        return self.runGit(['rev-list', '--count', '--left-only', self.parseId(newerId) + '...' + self.parseId(olderId)])
        
    def reset(self, hard=True):
        params = ['reset']
        if hard:
            params.append('--hard')
        return self.runGit(params)
        
    def diff(self, id=None, path=None):
        params = ['diff']
        if id:
            params.append(self.parseId(id))
        if path:
            params.append('--')
            params.append(path)
        return self.runGit(params)
        
    def getBranches(self, id, remoteOnly=True):
        branches = []
        refListStr = self.runGit(['log', '--format="%d"', '--max-count=1', id])
        refList = refListStr.strip('"').strip().lstrip('(').rstrip(')').split(', ')
        for item in refList:
            if not 'tag:' in item:
                remote = item.startswith('origin/')
                name = item[len('origin/'):] if remote else item
                if remote or (not remoteOnly):
                    branches.append(Branch(name, remote))
        return branches
        
    def getInfo(self, id):
        return self.runGit(['log', '--max-count=1', self.parseId(id)])
        
    def conflicts(self):
        conflicts = []
        for line in self.status().splitlines():
            fields = line.split(' ', 1)
            if 'U' in fields[0]:
                conflicts.append((fields[1].strip(), self.diff(path=fields[1])))
        return conflicts
        
    def parseId(self, id):
        commit = id
        if type(id) is Branch:
            if id.remote:
                commit = 'origin/' + id.name
        return commit
        
    class GitError(Exception):
        def __init__(self, result_code, text):
            self.result_code = result_code
            self.text = text
        def __str__(self):
            return str(self.result_code) + ': ' + self.text

    def runGit(self, args):
        params = args
        if not type(args) is list:
            params = [args]
            
        process = subprocess.Popen([self.gitExecutable] + params, cwd=self.repositoryPath, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        response = process.communicate()
        if process.returncode != 0:
            raise self.GitError(process.returncode, response[1].decode('UTF-8').rstrip())
            
        return response[0].decode('UTF-8').rstrip()