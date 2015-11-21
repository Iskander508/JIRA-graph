#!/usr/bin/env python
# -*- coding: utf-8 -*-

import json

def enum(**enums):
    return type('Enum', (), enums)
    
def setToList(object):
    if type(object) is list:
        result = []
        for item in object:
            result.append(setToList(item))
        return result
        
    if type(object) is dict:
        result = {}
        for key, value in object.items():
            result[key] = setToList(value)
        return result
        
    if type(object) is set:
        result = []
        for value in object:
            result.append(setToList(value))
        return result
        
    return object
        
    
class GraphError(Exception):
    def __init__(self, value):
        self.value = value
    def __str__(self):
        return repr(self.value)


class Node:
    Type = enum(JIRA='JIRA', GIT='git', STASH='stash')
    def __init__(self, id, _type, data):
        self.id = id
        self._type = _type
        self.data = data
        
        if not (_type == Node.Type.JIRA or _type == Node.Type.GIT or _type == Node.Type.STASH):
            raise GraphError('Invalid node type: ' + _type)
        
        if _type == Node.Type.JIRA:
            if ((not 'type' in data)
                or (not 'URL' in data)
                or (not 'code' in data)
                or (not 'summary' in data)
                or (not 'assignee' in data)
                or (not 'status' in data)
                or (not 'statusColor' in data)
                or (not 'completed' in data)
                or (not 'estimated' in data)):
                    raise GraphError('Missing field in JIRA data node: ' + json.dumps(data, indent=4))
                    
        if _type == Node.Type.GIT:
            if (not 'type' in data):
                    raise GraphError('Missing field in git data node: ' + json.dumps(data, indent=4))
                    
        if _type == Node.Type.STASH:
            if ((not 'reviewers' in data)
                or (not 'name' in data)
                or (not 'URL' in data)):
                    raise GraphError('Missing field in stash data node: ' + json.dumps(data, indent=4))
                    
    def toObject(self):
        return {
            'id': self.id,
            'type': self._type,
            'data': setToList(self.data)
            }

class Edge:
    def __init__(self, source, target, _type=None):
        self.source = source
        self.target = target
        self._type = _type
        
        if source == target:
            raise GraphError('Invalid edge - source and target same: ' + source)
        
    def toObject(self):
        object = {
            'source': self.source,
            'target': self.target
            }
        if self._type:
            object['type'] = setToList(self._type)
        return object
        
class Graph:
    def __init__(self):
        self.nodes = []
        self.nodeIds = set()
        self.edges = []

    def hasNode(self, nodeId):
        return nodeId in self.nodeIds
        
    def addNode(self, node):
        if not isinstance(node, Node):
            raise GraphError('Not a node object: ' + repr(node))
            
        if node.id in self.nodeIds:
            raise GraphError('Node already added to graph: ' + node.id)
                
        self.nodes.append(node)
        self.nodeIds.add(node.id)
        
    def addEdge(self, edge):
        if not isinstance(edge, Edge):
            raise GraphError('Not a edge object: ' + repr(edge))
        self.edges.append(edge)
        
    def saveGraphJson(self, filePath, additionalData=None):
        import datetime
        
        output = {
            'nodes': [],
            'edges': [],
            'timestamp': datetime.datetime.now().strftime('%d.%m.%Y %X')
            }
            
        if additionalData:
            for key, value in additionalData.items():
                output[key] = value
            
        for node in self.nodes:
            output['nodes'].append(node.toObject())
                
        for edge in self.edges:
            if (edge.source in self.nodeIds) and (edge.target in self.nodeIds):
                output['edges'].append(edge.toObject())
                
        with open(filePath, 'w') as outfile:
            outfile.write(json.dumps(output, indent=4, ensure_ascii=False).encode('utf-8'))