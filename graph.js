
// Generates a unique string identifier
function makeUniqueId() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < 16; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

function issueIsDone(issueData) {
    return 'done' in issueData && issueData.done || issueData.status == 'Done';
}

function issueIsOpen(issueData) {
    return issueData.status == 'Open';
}

function renderGraph(content, options) {

    var graph = Viva.Graph.graph();

    var showJIRAissues = (options.indexOf('JIRA') != -1);
    var showALLissues = (options.indexOf('JIRA-all') != -1);
    var showPullRequests = (options.indexOf('pull') != -1);
    var showBranches = (options.indexOf('branches') != -1);
    var showMergedBranches = (options.indexOf('merged') != -1);
    var showConflicts = (options.indexOf('conflicts') != -1);
    var hideOrphans = (options.indexOf('hide-orphans') != -1);

    var displayedNodeIds = new Set();

    var nodeToEdgesMap = {};
    var nodeToDataMap = {};

    
    for (var index = 0; index < content.nodes.length; index++) {
        var node = content.nodes[index];
        node["svgObject"] = null;

        nodeToEdgesMap[node.id] = [];
        nodeToDataMap[node.id] = node;

        if (!showJIRAissues && node.type == 'JIRA') continue;
        if (!showBranches && node.type == 'git') continue;
        if (!showMergedBranches && node.type == 'git' && node.data.inMaster && !node.data.mergeBase) continue;
        if (!showConflicts && node.type == 'git' && node.data.type == 'conflict') continue;
        if (!showPullRequests && node.type == 'stash') continue;

        graph.addNode(node.id, node);
        displayedNodeIds.add(node.id);
    }
    
    for (var index = 0; index < content.edges.length; index++) {
        var edge = content.edges[index];

        nodeToEdgesMap[edge.source].push(edge);
        nodeToEdgesMap[edge.target].push(edge);

        if (!displayedNodeIds.has(edge.source) || !displayedNodeIds.has(edge.target)) continue;
        graph.addLink(edge.source, edge.target, edge.type);
    }

    var nodeIdsToRemove = new Set();
    if (!showALLissues) {
        var isInactiveIssue = function(node, graph, level) {
            if (level > 20) return false;
            if (node.data.type != 'JIRA') return false;

            var issueData = node.data.data;
            if (!issueIsDone(issueData) && !issueIsOpen(issueData)) return false;
            if ('pullRequests' in issueData) {
                var inactive = true;
                issueData.pullRequests.forEach(function(pullRequest) {
                    if (pullRequest.status == 'OPEN') inactive = false;
                });
                if (!inactive) return false;
            }
            if ('branches' in issueData || 'subtasks' in issueData) {
                var inactive = true;
                graph.getLinks(node.id).forEach(function(link) {
                    var target = graph.getNode(link.toId);
                    switch (target.data.type) {
                        case 'JIRA':
                            if (isInactiveIssue(target, graph, level+1)) {
                                inactive = false;
                            }
                            break;
                        case 'git':
                            if (!target.data.data.inMaster && !target.data.data.master) {
                                inactive = false;
                            }
                            break;
                    }
                });
                if (!inactive) return false;
            }
            return true;
        };

        graph.forEachNode(function(node) {
            if (isInactiveIssue(node, graph, 0)) {
                nodeIdsToRemove.add(node.id);
            }
        });
    }

    if (hideOrphans) {
        graph.forEachNode(function(node) {
            if (graph.getLinks(node.id).length == 0) {
                nodeIdsToRemove.add(node.id);
            }
        });
    }

    nodeIdsToRemove.forEach(function (nodeId) {
        graph.removeNode(nodeId);
        displayedNodeIds.delete(nodeId);
    });
    
    
    // returns true when there exists a path (indirected) from sourceId to targetId without using node from omitIds
    function commitPairIsConnected(sourceId, targetId, omitIds) {
        var connected = false;
        graph.forEachLinkedNode(sourceId, function(otherNode, link){
            if (omitIds.indexOf(otherNode.id) != -1) return;
            if (otherNode.data.type != 'git' || otherNode.data.data.type == 'conflict') return;
            
            if (connected = connected || (otherNode.id == targetId)) return;
            
            if (commitPairIsConnected(otherNode.id, targetId, omitIds.concat([sourceId]))) {
                connected = true;
            }
        });
        return connected;
    }
    
    // returns true when there exists a path (indirected) among all nodeIds without using node from omitIds
    function commitsAreConnected(nodeIds, omitIds) {
        for (var index1 = 0; index1 < nodeIds.length; index1++) {
            for (var index2 = index1 + 1; index2 < nodeIds.length; index2++) {
                if (!commitPairIsConnected(nodeIds[index1], nodeIds[index2], omitIds)) return false;
            }
        }
        return true;
    }
    
    
    // shrink git commit nodes
    {
        var tryNext = true;
        while(tryNext) {
            graph.forEachNode(function(node) {
                if (!tryNext || node.data.type != 'git' || node.data.data.type != 'commit') return;
                
                var links = graph.getLinks(node.id);
                var inLinkCount = 0;
                var outLinkCount = 0;
                var inLink = null;
                var outLink = null;
                var outIds = [];
                for (var index = 0; index < links.length; index++) {
                    var link = links[index];
                    if (link.toId == node.id) {
                        inLinkCount++;
                        inLink = link;
                    } else {
                        outLinkCount++;
                        outLink = link;
                        outIds.push(link.toId);
                    }
                }
                
                if (inLinkCount == 0 && (commitsAreConnected(outIds, [node.id]))) {
                } else if (inLinkCount == 1 && outLinkCount == 1) {
                    var numCommits = parseInt(outLink.data, 10) + parseInt(outLink.data, 10);
                    graph.addLink(inLink.fromId, outLink.toId, '' + numCommits);
                } else return;
                
                graph.removeNode(node.id);
                displayedNodeIds.delete(node.id);
                tryNext = false;
            });
            
            tryNext = !tryNext;
        }
    }



    var graphics = Viva.Graph.View.svgGraphics();




    var findClass = function (svgObject, className) {
        var curClass = svgObject.attr("class");
        var curClasses = curClass ? curClass.split(' ') : [];
        var index = curClasses.indexOf(className);
        return [(index != -1), index, curClasses];
    };

    var hasClass = function (svgObject, className) {
        return findClass(svgObject, className)[0];
    };

    var setClass = function (svgObject, className, isOn) {
        var found = findClass(svgObject, className);
        if (found[0] == isOn) return;

        if (isOn) {
            found[2].push(className);
        } else {
            found[2].splice(found[1], 1);
        }
        svgObject.attr("class", found[2].join(' '));
    };

    var toggleClass = function (svgObject, className) {
        var found = findClass(svgObject, className);

        if (found[0]) {
            found[2].splice(found[1], 1);
        } else {
            found[2].push(className);
        }
        svgObject.attr("class", found[2].join(' '));
    };


    var highlightCommits = function(nodeId, isOn, successors, omitConflicts) {
        graph.forEachLinkedNode(nodeId, function(otherNode, link){
            if (otherNode.id == (successors ? link.fromId : link.toId)) return; // only derived commits
            if (otherNode.data.type != 'git') return;
            
            var linkUI = graphics.getLinkUI(link.id);
            if (linkUI) {
                if (otherNode.data.data.type == 'conflict') {
                    if (!successors || omitConflicts) return;
                    setClass(otherNode.data.svgObject, "highlight-conflict", isOn);
                    graph.forEachLinkedNode(otherNode.id, function(nextNode, nextLink){
                        var nextLinkUI = graphics.getLinkUI(nextLink.id);
                        if (nextLinkUI) {
                            setClass(nextLinkUI, "highlight-conflict", isOn);
                        }
                        if (nextLink.fromId != nodeId) {
                            setClass(nextNode.data.svgObject, "highlight-conflict", isOn);
                        }
                    });
                } else {
                    var highlightClass = successors ? "highlight-successor" : "highlight-predecessor";
                    setClass(linkUI, highlightClass, isOn);
                    setClass(otherNode.data.svgObject, highlightClass, isOn);
                    highlightCommits(otherNode.id, isOn, successors, true);
                }
            }
        });
    };

    var showIssues = function (node) {
        toggleClass(node.data.svgObject, "selected");

        if (!hasClass(node.data.svgObject, "selected")) {
            var toBeRemoved = [];
            graph.forEachLinkedNode(node.id, function (otherNode, link) {
                if (otherNode.data.type == 'JIRA') {
                    toBeRemoved.push(otherNode.id);
                }
            });

            for (var index = 0; index < toBeRemoved.length; index++) {
                graph.removeNode(toBeRemoved[index]);
                displayedNodeIds.delete(toBeRemoved[index]);
            }

            return;
        }

        var edges = nodeToEdgesMap[node.id];
        for (var index = 0; index < edges.length; index++) {
            var edge = edges[index];
            var otherNodeId = (edge.source == node.id) ? edge.target : edge.source;
            if (displayedNodeIds.has(otherNodeId)) continue;

            var nodeItem = nodeToDataMap[otherNodeId];
            if (nodeItem.type == 'JIRA') {
                graph.addNode(nodeItem.id, nodeItem);
                displayedNodeIds.add(nodeItem.id);
                graph.addLink(edge.source, edge.target, edge.type);
            }
        }
    };

    var highlightPullRequest = function(node, isOn) {
        setClass(node.data.svgObject, "highlight-level-1", isOn);
        graph.forEachLinkedNode(node.id, function(otherNode, link){
            var linkUI = graphics.getLinkUI(link.id);
            if (linkUI) {
                if (otherNode.data.type == 'git') {
                    var successor = (otherNode.id == link.toId);
                    var highlightClass = successor ? "highlight-successor" : "highlight-predecessor";
                    setClass(otherNode.data.svgObject, highlightClass, isOn);
                    setClass(linkUI, highlightClass, isOn);
                }
            }
        });
    };

    var highlightIssue = function(node, isOn, level) {
        if (level == 0) return;

        setClass(node.data.svgObject, "highlight-level-" + level, isOn);
        if (node.data.type == 'JIRA') {
            graph.forEachLinkedNode(node.id, function(otherNode, link){
                highlightIssue(otherNode, isOn, level - 1);
            });
        }
    };
    
    var highlightConflict = function(node, isOn) {
        setClass(node.data.svgObject, "highlight-level-3", isOn);
        graph.forEachLinkedNode(node.id, function(otherNode, link){
            setClass(otherNode.data.svgObject, "highlight-level-2", isOn);
            var linkUI = graphics.getLinkUI(link.id);
            if (linkUI) {
                setClass(otherNode.data.svgObject, "highlight-conflict", isOn);
                setClass(linkUI, "highlight-conflict", isOn);
            }
        });
    };

    graphics.node(function (node) {

        var svgNode = Viva.Graph.svg('g');
        svgNode.attr('id', node.id + '_' + makeUniqueId());
        var classes = node.data.type;
        if ('type' in node.data.data) {
            classes += ' ' + node.data.data.type;
        }
        svgNode.attr('class', classes);
        
        {
            var nodeRect = Viva.Graph.svg('rect').attr('class', 'boundary');
            nodeRect["layout"] = false;
            svgNode.append(nodeRect);
            svgNode["boundary"] = nodeRect;
        }

        switch (node.data.type) {
            case 'JIRA':
                {
                    var issueData = node.data.data;
                    
                    {
                        var nodeLine = Viva.Graph.svg('line')
                            .attr('stroke-width', '5').attr('class', 'issue-type')
                            .attr('x1', 2).attr('y1', 0).attr('x2', 2).attr('y2', 46);
                        nodeLine.append(Viva.Graph.svg('title').text(issueData.type));
                        svgNode.append(nodeLine);
                    }

                    {
                        var svgTitle = Viva.Graph.svg('a');
                        svgTitle.link(issueData.URL);
                        svgTitle.attr('target', '_blank');
                        svgTitle.append(Viva.Graph.svg('title').text(issueData.code + ': ' + issueData.summary));

                        var svgText = Viva.Graph.svg('text')
                            .attr('x', 7)
                            .attr('y', 15)
                            .text(issueData.code + ': ' + issueData.summary);

                        if (issueIsDone(issueData)) {
                            svgText.attr('class', 'done');
                        }
                        svgTitle.append(svgText);
                        svgNode.append(svgTitle);
                    }

                    {
                        var svgImage = Viva.Graph.svg('image')
                           .attr('width', 24)
                           .attr('height', 24)
                           .attr('x', 7).attr('y', 20)
                           .link(issueData.assigneeImage);
                        svgImage.append(Viva.Graph.svg('title').text(issueData.assignee));
                        svgNode.append(svgImage);
                    }

                    var statusX = 37;
                    if (issueData.epic) {
                        var svgRect = Viva.Graph.svg('rect')
                            .attr('x', statusX)
                            .attr('y', 20)
                            .attr('width', 70)
                            .attr('height', 20)
                            .attr('rx', 4)
                            .attr('class', issueData.epicColor);
                        svgNode.append(svgRect);

                        var svgEpic = Viva.Graph.svg('text')
                            .attr('x', statusX + 5)
                            .attr('y', 35)
                            .attr('class', issueData.epicColor)
                            .text(issueData.epic.substring(0, 7));
                        svgEpic.append(Viva.Graph.svg('title').text(issueData.epic));
                        svgNode.append(svgEpic);

                        statusX += 75;
                    }

                    {
                        var svgStatus = Viva.Graph.svg('g');
                        svgStatus.append(Viva.Graph.svg('title').text('completed: ' + issueData.completed + 'h\nremaining: ' + (issueData.estimated-issueData.completed) + 'h\ntotal: ' + issueData.estimated + 'h'));
                        
                        var svgStatusText = Viva.Graph.svg('text')
                            .attr('x', statusX).attr('y', 32)
                            .attr('fill', issueData.statusColor).attr('class', 'status')
                            .text(issueData.status + ' (' + issueData.completed + '/' + issueData.estimated + ')');
                        svgStatus.append(svgStatusText);
                        
                        if (issueData.estimated != 0) {
                            var totalLength = issueData.estimated*6;
                            if (totalLength > 200) totalLength = 200;
                            var completedLength = totalLength * issueData.completed / issueData.estimated;

                            if (completedLength > 0) {
                                var completedLine = Viva.Graph.svg('line')
                                    .attr('stroke-width', '3').attr('class', 'completed')
                                    .attr('x1', statusX).attr('y1', 37).attr('x2', statusX + completedLength).attr('y2', 37);
                                svgStatus.append(completedLine);
                            }

                            if (totalLength - completedLength > 0) {
                                var incompletedLine = Viva.Graph.svg('line')
                                    .attr('stroke-width', '3').attr('class', 'incompleted')
                                    .attr('x1', statusX + completedLength).attr('y1', 37).attr('x2', statusX + totalLength).attr('y2', 37);
                                svgStatus.append(incompletedLine);
                            }
                        }
                        svgNode.append(svgStatus);
                    }

                    $(svgNode).hover(function() { // mouse over
                        highlightIssue(node, true, 3);
                    }, function() { // mouse out
                        highlightIssue(node, false, 3);
                    });
                }
                break;
            case 'git':
                {
                    var gitData = node.data.data;
                    
                    switch(gitData.type) {
                    case 'branch':
                        {
                            {
                                var svgTitle = Viva.Graph.svg('a');
                                svgTitle.link(gitData.URL);
                                svgTitle.attr('target', '_blank');
                                
                                if (gitData.info) {
                                    svgTitle.append(Viva.Graph.svg('title').text(gitData.info));
                                }

                                {
                                    var svgImage = Viva.Graph.svg('image')
                                       .attr('width', 15)
                                       .attr('height', 17)
                                       .attr('x', 2).attr('y', 3)
                                       .link('branch.svg');
                                        svgImage.append(Viva.Graph.svg('title').text(gitData.master ? 'master branch' : 'branch'));
                                    svgNode.append(svgImage);
                                }

                                    
                                var startY = 17;
                                for (var index = 0; index < gitData.branchNames.length; index++) {
                                    var branchName = gitData.branchNames[index];
                                    var svgText = Viva.Graph.svg('text')
                                    .attr('x', 20).attr('y', startY)
                                    .text(branchName);

                                    if (content.masterBranches.indexOf(branchName) != -1) {
                                        svgText.attr('class', 'master');
                                    }

                                    svgTitle.append(svgText);
                                    startY += 15;
                                }
                                

                                svgNode.append(svgTitle);
                            }

                            if (gitData.master) {
                                svgNode.attr('class', svgNode.attr('class') + ' master');
                            }

                            $(svgNode).hover(function() { // mouse over
                                highlightCommits(node.id, true, true);
                                highlightCommits(node.id, true, false);
                            }, function() { // mouse out
                                highlightCommits(node.id, false, true);
                                highlightCommits(node.id, false, false);
                            });

                            if (!showJIRAissues) {
                                $(svgNode).click(function () { // mouse click
                                    showIssues(node);
                                });
                            }
                        }
                        break;
                        
                    case 'commit':
                        {
                            {
                                var svgTitle = Viva.Graph.svg('a');
                                svgTitle.link(gitData.URL);
                                svgTitle.attr('target', '_blank');                                
                                
                                if (gitData.info) {
                                    svgTitle.append(Viva.Graph.svg('title').text(gitData.info));
                                }

                                {
                                    var svgImage = Viva.Graph.svg('image')
                                       .attr('width', 15)
                                       .attr('height', 17)
                                       .attr('x', 2).attr('y', 3)
                                       .link('git.png');
                                    svgNode.append(svgImage);
                                }

                                var svgText = Viva.Graph.svg('text')
                                    .attr('x', 20)
                                    .attr('y', 17)
                                    .text(gitData.id.substring(0,10));
                                svgTitle.append(svgText);
                                
                                svgNode.append(svgTitle);
                            }

                            $(svgNode).hover(function() { // mouse over
                                highlightCommits(node.id, true, true);
                                highlightCommits(node.id, true, false);
                            }, function() { // mouse out
                                highlightCommits(node.id, false, true);
                                highlightCommits(node.id, false, false);
                            });
                        }
                        break;
                    
                    case 'conflict':
                        {
                            {
                                {
                                    var svgImage = Viva.Graph.svg('image')
                                       .attr('width', 15)
                                       .attr('height', 15)
                                       .attr('x', 2).attr('y', 4)
                                       .link('conflict.svg');
                                       svgImage.append(Viva.Graph.svg('title').text('potential merge conflict'));
                                    svgNode.append(svgImage);
                                }
                                
                                var startY = 15;
                                for (var index = 0; index < gitData.files.length; index++) {
                                    var file = gitData.files[index];
                                    
                                    var svgFileLink = Viva.Graph.svg('a');
                                    svgFileLink.link(file.URL);
                                    svgFileLink.attr('target', '_blank');
                                    svgFileLink.append(Viva.Graph.svg('text').attr('x', 20).attr('y', startY).text(file.file));
                                    
                                    if (file.diff) {
                                        svgFileLink.append(Viva.Graph.svg('title').text(file.diff));
                                    }
                                    
                                    svgNode.append(svgFileLink);
                                    startY += 15;
                                }
                            }

                            $(svgNode).hover(function() { // mouse over
                                highlightConflict(node, true);
                            }, function() { // mouse out
                                highlightConflict(node, false);
                            });
                        }
                        break;
                    }

                }
                break;
            case 'stash':
                {
                    var pullRequestData = node.data.data;

                    {
                        {
                            var svgImage = Viva.Graph.svg('image')
                               .attr('width', 15)
                               .attr('height', 15)
                               .attr('x', 2).attr('y', 3)
                               .link('pull-request.svg');
                            svgImage.append(Viva.Graph.svg('title').text('Pull request'));
                            svgNode.append(svgImage);
                        }

                        var svgTitle = Viva.Graph.svg('a');
                        svgTitle.link(pullRequestData.URL);
                        svgTitle.attr('target', '_blank');

                        
                        {
                            var svgText = Viva.Graph.svg('text')
                            .attr('x', 22)
                            .attr('y', 16)
                            .text(pullRequestData.id + ': ' + pullRequestData.name);
                            svgTitle.append(svgText);
                        }
                        
                        // tooltip
                        {
                            var text;
                            var index;
                            for (index = 0; index < pullRequestData.reviewers.length; ++index) {
                                var reviewer = pullRequestData.reviewers[index];
                                var line = reviewer.name + ' ' + (reviewer.approved ? '(✓)' : '(?)');

                                if (text) {
                                    text += '\n';
                                } else {
                                    text = 'Reviewers:\n';
                                }

                                text += line;
                            }

                            var svgTooltip = Viva.Graph.svg('title')
                                .text(pullRequestData.source + ' → ' + pullRequestData.destination + (text ? '\n' + text : ''));

                            svgTitle.append(svgTooltip);
                        }
                        svgNode.append(svgTitle);
                    }

                    $(svgNode).hover(function() { // mouse over
                        highlightPullRequest(node, true);
                    }, function() { // mouse out
                        highlightPullRequest(node, false);
                    });
                }
                break;
        }

        node.data["svgObject"] = svgNode;
        return svgNode;
    }).placeNode(function (node, pos) {
        // 'g' element doesn't have convenient (x,y) attributes, instead
        // we have to deal with transforms: http://www.w3.org/TR/SVG/coords.html#SVGGlobalTransformAttribute
        node.attr('transform',
                    'translate(' +
                          (pos.x) + ',' + (pos.y) +
                    ')');
                    
        if (!node.boundary.layout) {
            node.boundary.layout = true;
            var bbox = node.getBBox();
            node.boundary.attr('x', 0).attr('y', bbox.y).attr('width', bbox.width + 5).attr('height', bbox.height);
        }
    });











    // To render an arrow we have to address two problems:
    //  1. Links should start/stop at node's bounding box, not at the node center.
    //  2. Render an arrow shape at the end of the link.

    // Rendering arrow shape is achieved by using SVG markers, part of the SVG
    // standard: http://www.w3.org/TR/SVG/painting.html#Markers
    var marker = Viva.Graph.svg('marker')
                   .attr('id', 'Triangle')
                   .attr('viewBox', "0 0 10 10")
                   .attr('refX', 10)
                   .attr('refY', 5)
                   .attr('markerUnits', "strokeWidth")
                   .attr('markerWidth', 10)
                   .attr('markerHeight', 5)
                   .attr('orient', "auto");
    marker.append('path').attr('d', 'M 0 0 L 10 5 L 0 10 z');

    // Marker should be defined only once in <defs> child element of root <svg> element:
    var defs = graphics.getSvgRoot().append('defs');
    defs.append(marker);

    var geom = Viva.Graph.geom();



    graphics.link(function (link) {
        var path = Viva.Graph.svg('path');

        if (link.data) {
            path.attr('class', link.data);
        }

        if (link.data != 'links') {
            path.attr('marker-end', 'url(#Triangle)');
        }

        return path;
    }).placeLink(function (path, fromPos, toPos) {
        // Here we should take care about
        //  "Links should start/stop at node's bounding box, not at the node center."

        var source = graph.getNode(path.link.fromId);
        var target = graph.getNode(path.link.toId);
        
        var sourceElement = document.getElementById(source.data.svgObject.id);
        var targetElement = document.getElementById(target.data.svgObject.id);

        if (!sourceElement || !targetElement) return;

        var sourceRect = sourceElement.getBoundingClientRect();
        var targetRect = targetElement.getBoundingClientRect();

        var sourceWidth = sourceRect.width;
        var sourceHeight = sourceRect.height;
        var targetWidth = targetRect.width;
        var targetHeight = targetRect.height;
        
        var transformList = path.parentNode.transform.animVal;
        if (transformList.numberOfItems > 0) {
            var transform = transformList.getItem(0);
            switch(transform.type) {
                case SVGTransform.SVG_TRANSFORM_MATRIX:
                case SVGTransform.SVG_TRANSFORM_SCALE:
                    {
                        var scaleX = transform.matrix.a;
                        var scaleY = transform.matrix.d;

                        sourceWidth /= scaleX;
                        sourceHeight /= scaleY;
                        targetWidth /= scaleX;
                        targetHeight /= scaleY;
                    }
                    break;
            }
        }


        // For rectangular nodes Viva.Graph.geom() provides efficient way to find
        // an intersection point between segment and rectangle
        var fromMiddle = {
            'x': fromPos.x + sourceWidth / 2,
            'y': fromPos.y + sourceHeight / 2
        };
        var toMiddle = {
            'x': toPos.x + targetWidth / 2,
            'y': toPos.y + targetHeight / 2
        };

        var from = geom.intersectRect(
                // rectangle:
                        fromPos.x, // left
                        fromPos.y, // top
                        fromPos.x + sourceWidth, // right
                        fromPos.y + sourceHeight, // bottom
                // segment:
                        fromMiddle.x, fromMiddle.y, toMiddle.x, toMiddle.y)
                   || fromMiddle; // if no intersection found - return center of the node

        var to = geom.intersectRect(
                // rectangle:
                        toPos.x, // left
                        toPos.y, // top
                        toPos.x + targetWidth, // right
                        toPos.y + targetHeight, // bottom
                // segment:
                        fromMiddle.x, fromMiddle.y, toMiddle.x, toMiddle.y)
                    || toMiddle; // if no intersection found - return center of the node

        var data = 'M ' + from.x + ' ' + from.y +
                   ' L ' + to.x + ' ' + to.y;

        path.attr("d", data);

        if (path.link.data) {
            if (!path.label) {
                var svgText = Viva.Graph.svg('text').text(path.link.data);
                svgText.attr('font-size', 9);
                path.parentNode.append(svgText);
                path["label"] = svgText;
            }

            path.label.attr('x', (from.x + to.x) / 2).attr('y', (from.y + to.y) / 2);
        }
        
        //if (isIE) {
            var parent = path.parentNode;
            parent.removeChild(path);
            parent.appendChild(path);
        //}
    });


    // Render the graph
    var layout = Viva.Graph.Layout.forceDirected(graph, {
        springLength: 80,
        springCoeff: 0.00002,
        //dragCoeff: 0.00002,
        gravity: -20,
        timeStep: 20,
        stableThreshold: 0.03
       // dragCoeff: 0.02,
        //gravity: 0.1
        /*springLength: 150,
        springCoeff: 0.0008,
        gravity: -1.2,
        theta: 1.8,
        dragCoeff: 0.0002,
        timeStep: 5*/
    });

    var renderer = Viva.Graph.View.renderer(graph, {
        graphics: graphics,
        layout: layout
    });
    renderer.run(50);
    return renderer;
}