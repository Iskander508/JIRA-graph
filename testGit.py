#!/usr/bin/env python
# -*- coding: utf-8 -*-

import git

g = git.GIT(repositoryPath='H:\\zaap\\client')
#result = g.checkout(git.Branch('master'))
#result = g.merge(git.Branch('master'))
result = g.getBranches('4ccc3ea6f568e5afee9bcf91882f99aadf413097')
print(result)
