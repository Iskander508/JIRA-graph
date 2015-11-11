#!/usr/bin/env python
# -*- coding: utf-8 -*-

import copy

class GitGraph:
    def __init__(self, git):
        self.git = git
        self.nodes = set()
        self.predecessors = {}
        self.successors = {}
        
    def __repr__(self):
        result = ''
        for id in self.nodes:
            result += '\n' + id
            
            for S in self.getSuccessors(id):
                result += '\n\t' + id + ' ->(' + self.git.getDistance(id, S) + ') ' + S
            
        return result
        
    class Error(Exception):
        def __init__(self, text):
            self.text = text
        def __str__(self):
            return str(self.text)
        
    def has(self, id):
        return id in self.nodes
        
    def getPredecessors(self, id, direct=True):
        if not self.has(id):
            raise self.Error('Id not added: ' + id)
            
        if direct:
            return self.predecessors[id]
        else:
            directPredecessors = self.predecessors[id]
            predecessors = copy.deepcopy(directPredecessors)
            for P in directPredecessors:
                predecessors.update(self.getPredecessors(P, False))
             
            return predecessors
        
    def getSuccessors(self, id, direct=True):
        if not self.has(id):
            raise self.Error('Id not added: ' + id)

        if direct:
            return self.successors[id]
        else:
            directSuccessors = self.successors[id]
            successors = copy.deepcopy(directSuccessors)
            for S in directSuccessors:
                successors.update(self.getSuccessors(S, False))
             
            return successors
        
    def getIds(self):
        return copy.deepcopy(self.nodes)
        
    def add(self, gitId):
        A = self.git.revParse(gitId)
        if self.has(A):
            raise self.Error('Item(' + gitId +') already added: ' + A)

        # fill successors and predecessors
        successors = set()
        predecessors = set()
        for B in self.getIds():
            mergeBase = self.git.mergeBase(A, B)
            if (not self.has(mergeBase)) and (mergeBase != A):
                predecessors.add(mergeBase)
                self.add(mergeBase) # add predecessor first
            else:
                if mergeBase == A:
                    successors.add(B)
                if mergeBase == B:
                    predecessors.add(B)
                    
        # check correctness (predecessors and successors are disjoint)
        if not successors.isdisjoint(predecessors):
            raise self.Error('Successors and predecessors of (' + A + ') are not disjoint')
                    
        # integrate into graph
        self.predecessors.update({A:set()})
        self.successors.update({A:set()})
        
        for B in self.getIds():
            # A -> B
            if B in successors:
                add = True
                for P in self.getPredecessors(B): # P -> B
                    if P in successors: # ? A -> P
                        add = False # A -/> B
                        break
                if add:
                    self.successors[A].add(B)
                    self.predecessors[B].add(A)
                    
                    for P in predecessors: # P -> A
                        # P -/> B
                        self.predecessors[B].discard(P)
                        self.successors[P].discard(B)
                        
            # B -> A
            elif B in predecessors:
                add = True
                for S in self.getSuccessors(B): # B -> S
                    if S in predecessors: # ? S -> A
                        add = False # B -/> A
                        break
                if add:
                    self.successors[B].add(A)
                    self.predecessors[A].add(B)
                    
                    for S in successors: # A -> S
                        # B -/> S
                        self.predecessors[S].discard(B)
                        self.successors[B].discard(S)
                        
        self.nodes.add(A)