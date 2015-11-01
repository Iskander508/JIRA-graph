#!/usr/bin/env python
# -*- coding: utf-8 -*-

import graph

g = graph.Graph()
g.addNode(graph.Node('id1', graph.Node.Type.JIRA, {
    "type": "TestingSubtask",
    "URL": "www.seznam.cz",
    "code": "ZPL-322",
    "summary": "Component automation",
    "assignee": "Milan Dubský",
    "assigneeImage": "https://secure.gravatar.com/avatar/91bad8ceeec43ae303790f8fe238164b",
    "status": "In Progress",
    "statusColor": "tan",
    "completed": 3,
    "estimated": 5
    }))
g.addNode(graph.Node('id2', graph.Node.Type.GIT, {
    "type": "branch",
    "URL": "http://www.seznam.cz",
    "name": "zaap/devel",
    "master": True
    }))

g.addEdge(graph.Edge('id1','id2', 'subtask'))
g.addEdge(graph.Edge('id1','id3', 'invalid'))

g.saveGraphJson('test.json', {'Caption': 'Test'})
