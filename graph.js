
// Generates a unique string identifier
function makeUniqueId() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < 16; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

function renderGraph(content) {

    var graph = Viva.Graph.graph();

    {
        var node;
        for (node of content.nodes) {
            graph.addNode(node.id, node);
        }
    }
    {
        var edge;
        for (edge of content.edges) {
            graph.addLink(edge.source, edge.target, edge.type);
        }
    }
    


    var graphics = Viva.Graph.View.svgGraphics();
    graphics.node(function (node) {

        var svgNode = Viva.Graph.svg('g');
        svgNode.attr('id', node.id + '_' + makeUniqueId());
        var classes = node.data.type;
        if ('type' in node.data.data) {
            classes += ' ' + node.data.data.type;
        }
        svgNode.attr('class', classes);

        switch (node.data.type) {
            case 'JIRA':
                {
                    var issueData = node.data.data;
                    
                    {
                        var nodeLine = Viva.Graph.svg('line');
                        nodeLine.attr('stroke-width', '5')
                        .attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', '46px');
                        svgNode.append(nodeLine);
                    }

                    {
                        var svgTitle = Viva.Graph.svg('a');
                        svgTitle.link(issueData.URL);
                        svgTitle.attr('target', '_blank');

                        var svgText = Viva.Graph.svg('text')
                            .attr('x', 5)
                            .attr('y', 15)
                            .text(issueData.code + ': ' + issueData.summary);
                        svgTitle.append(svgText);
                        svgNode.append(svgTitle);
                    }

                    {
                        var svgImage = Viva.Graph.svg('image')
                           .attr('width', 24)
                           .attr('height', 24)
                           .attr('x', 5).attr('y', 20)
                           .link(issueData.assigneeImage);
                        svgImage.append(Viva.Graph.svg('title').text(issueData.assignee));
                        svgNode.append(svgImage);
                    }

                    var statusX = 35;
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
                        var svgStatus = Viva.Graph.svg('text')
                            .attr('x', statusX)
                            .attr('y', 35)
                            .attr('fill', issueData.statusColor)
                            .text(issueData.status + ' (' + issueData.completed + '/' + issueData.estimated + ')');
                        svgStatus.append(Viva.Graph.svg('title').text('completed: ' + issueData.completed + 'h\ntotal: ' + issueData.estimated + 'h'));
                        svgNode.append(svgStatus);
                    }
                }
                break;
            case 'git':
                {
                    var gitData = node.data.data;

                    {
                        var svgTitle = Viva.Graph.svg('a');
                        svgTitle.link(gitData.URL);
                        svgTitle.attr('target', '_blank');

                        var svgText = Viva.Graph.svg('text')
                            .attr('x', 5)
                            .attr('y', 15)
                            .text(gitData.name);
                        svgTitle.append(svgText);
                        svgNode.append(svgTitle);
                    }

                    if (gitData.master) {
                        svgNode.attr('class', svgNode.attr('class') + ' master');
                    }
                }
                break;
            case 'stash':
                {
                    var pullRequestData = node.data.data;

                    {
                        var svgTitle = Viva.Graph.svg('a');
                        svgTitle.link(pullRequestData.URL);
                        svgTitle.attr('target', '_blank');

                        {
                            var svgText = Viva.Graph.svg('text')
                            .attr('x', 5)
                            .attr('y', 15)
                            .text(pullRequestData.id + ': ' + pullRequestData.name);
                            svgTitle.append(svgText);
                        }
                        
                        // tooltip
                        {
                            var text;
                            var index;
                            for (index = 0; index < pullRequestData.reviewers.length; ++index) {
                                var reviewer = pullRequestData.reviewers[index];
                                var line = reviewer.name + ' ' + (reviewer.approved ? '(OK)' : '(?)');

                                if (text) {
                                    text += '\n';
                                } else {
                                    text = 'Reviewers:\n';
                                }

                                text += line;
                            }

                            var svgTooltip = Viva.Graph.svg('title');
                            if (text) {
                                svgTooltip.text(text);
                            }

                            svgTitle.append(svgTooltip);
                        }
                        svgNode.append(svgTitle);
                    }
                }
                break;
        }

        node.data = svgNode;
        return svgNode;
    }).placeNode(function (nodeUI, pos) {
        // 'g' element doesn't have convenient (x,y) attributes, instead
        // we have to deal with transforms: http://www.w3.org/TR/SVG/coords.html#SVGGlobalTransformAttribute
        nodeUI.attr('transform',
                    'translate(' +
                          (pos.x) + ',' + (pos.y) +
                    ')');
    });











    // To render an arrow we have to address two problems:
    //  1. Links should start/stop at node's bounding box, not at the node center.
    //  2. Render an arrow shape at the end of the link.

    // Rendering arrow shape is achieved by using SVG markers, part of the SVG
    // standard: http://www.w3.org/TR/SVG/painting.html#Markers
    var marker = Viva.Graph.svg('marker')
                   .attr('id', 'Triangle')
                   .attr('viewBox', "0 0 10 10")
                   .attr('refX', "10")
                   .attr('refY', "5")
                   .attr('markerUnits', "strokeWidth")
                   .attr('markerWidth', "10")
                   .attr('markerHeight', "5")
                   .attr('orient', "auto");
    marker.append('path').attr('d', 'M 0 0 L 10 5 L 0 10 z');

    // Marker should be defined only once in <defs> child element of root <svg> element:
    var defs = graphics.getSvgRoot().append('defs');
    defs.append(marker);

    var geom = Viva.Graph.geom();



    graphics.link(function (link) {
        // Notice the Triangle marker-end attribe:
        var path = Viva.Graph.svg('path');

        switch (link.data) {
            case 'blocks': path.attr('stroke', 'red'); break;
            case 'depends': path.attr('stroke', 'brown'); break;
            default: path.attr('stroke', 'gray'); break;
        }
        path.attr('fill', 'gray');

        if (link.data != 'links') {
            path.attr('marker-end', 'url(#Triangle)');
        }

        return path;
    }).placeLink(function (path, fromPos, toPos) {
        // Here we should take care about
        //  "Links should start/stop at node's bounding box, not at the node center."

        var source = graph.getNode(path.link.fromId);
        var target = graph.getNode(path.link.toId);

        var sourceRect = document.getElementById(source.data.id).getBoundingClientRect();
        var targetRect = document.getElementById(target.data.id).getBoundingClientRect();

        // For rectangular nodes Viva.Graph.geom() provides efficient way to find
        // an intersection point between segment and rectangle
        var fromMiddle = {
            'x': fromPos.x + sourceRect.width / 2,
            'y': fromPos.y + sourceRect.height / 2
        };
        var toMiddle = {
            'x': toPos.x + targetRect.width / 2,
            'y': toPos.y + targetRect.height / 2
        };

        var from = geom.intersectRect(
                // rectangle:
                        fromPos.x, // left
                        fromPos.y, // top
                        fromPos.x + sourceRect.width, // right
                        fromPos.y + sourceRect.height, // bottom
                // segment:
                        fromMiddle.x, fromMiddle.y, toMiddle.x, toMiddle.y)
                   || fromMiddle; // if no intersection found - return center of the node

        var to = geom.intersectRect(
                // rectangle:
                        toPos.x, // left
                        toPos.y, // top
                        toPos.x + targetRect.width, // right
                        toPos.y + targetRect.height, // bottom
                // segment:
                        fromMiddle.x, fromMiddle.y, toMiddle.x, toMiddle.y)
                    || toMiddle; // if no intersection found - return center of the node

        var data = 'M' + from.x + ',' + from.y +
                   'L' + to.x + ',' + to.y;

        if (path.link.data) {
            if (!path.label) {
                var svgText = Viva.Graph.svg('text').text(path.link.data);
                svgText.attr('font-size', 9);
                path.parentElement.append(svgText);
                path["label"] = svgText;
            }

            path.label.attr('x', (from.x + to.x) / 2).attr('y', (from.y + to.y) / 2);
        }

        path.attr("d", data);
    });


    // Render the graph
    var layout = Viva.Graph.Layout.forceDirected(graph, {
        springLength: 150,
        springCoeff: 0.00005,
        //dragCoeff: 0.002,
        //gravity: -1,
        timeStep: 50
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
}