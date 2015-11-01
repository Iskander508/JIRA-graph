#!/usr/bin/env python
# -*- coding: utf-8 -*-

import jira
import json

j = jira.JIRA(url='https://jira.atlassian.com', auth=None)
issue = j.getIssue('DEMO-5460')
print(json.dumps(issue, indent=4))
