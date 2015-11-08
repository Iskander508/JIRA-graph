#!/usr/bin/env python
# -*- coding: utf-8 -*-

import git
import gitGraph

g = gitGraph.GitGraph(git.GIT(repositoryPath='D:\\otevrenebrno\\otevrenebrno'))

#result = g.checkout(git.Branch('master'))
#result = g.merge(git.Branch('master'))
g.add('master')
g.add('origin/document_parser')
g.add('origin/angular-leaflet-directive')
g.add('fbf15af421249789af73a760da0a9a44041861d2')
g.add('10e2e79be307dac9f1628240f9e4bd3b1402e1c2')
g.add('d1be5303e7cec10fed619c159427120129d16842')
g.add('ef7d45802a4c22e3a43f5c1125c5a48994953123')
print(g)
