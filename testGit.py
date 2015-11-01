#!/usr/bin/env python
# -*- coding: utf-8 -*-

import git

g = git.GIT(repositoryPath='D:\\streetcleaning')
#result = g.checkout(git.Branch('master'))
#result = g.merge(git.Branch('master'))
result = g.reset()
print(result)
