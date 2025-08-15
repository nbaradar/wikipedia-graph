# Wikipedia Ontology Graph Explorer

A modern, interactive visualization tool that displays Wikipedia articles as connected graph nodes, similar to Obsidian's graph view. Users can search for any Wikipedia article and see its connections to other articles in a beautiful, responsive interface.

## Features

- **Interactive Search**: Real-time autocomplete suggestions from Wikipedia
- **Graph Visualization**: D3.js-powered interactive graph with smooth animations
- **Modern UI**: Clean, responsive design with smooth transitions
- **One-Layer Connections**: Shows central article connected to its main linked articles
- **Click Navigation**: Click any node to open the corresponding Wikipedia article
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## How to Use

1. **Search**: Type any topic in the search bar to get Wikipedia article suggestions
2. **Select**: Choose an article from the dropdown or press Enter
3. **Explore**: View the interactive graph with your topic at the center
4. **Navigate**: Click any connected node to open that Wikipedia article
5. **New Search**: Use the top search bar to explore new topics

## Technical Details

### Built With
- **D3.js v7**: For graph visualization and force simulation
- **Wikipedia REST API**: For fetching article data and suggestions
- **Vanilla JavaScript**: No frameworks, pure ES6+ code
- **CSS3**: Modern styling with gradients, animations, and responsive design

### APIs Used
- Wikipedia REST API for article summaries
- Wikipedia OpenSearch API for autocomplete suggestions
- Wikipedia Query API for extracting article links

### Graph Structure
- **Central Node**: The searched article (red, larger)
- **Connected Nodes**: Main articles linked from the central article (blue, smaller)
- **Links**: Visual connections showing relationships
- **Force Simulation**: Physics-based layout for natural node positioning

## File Structure

```
├── index.html          # Main HTML structure
├── styles.css          # Modern CSS styling and animations
├── script.js           # Core JavaScript application logic
└── README.md           # This documentation
```

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## CORS Considerations

The application uses Wikipedia's public APIs with CORS support. All API calls include the `origin=*` parameter where needed to ensure cross-origin requests work properly.

## Future Enhancements

- Multi-layer exploration (expand nodes to show their connections)
- Search history and bookmarks
- Different visualization layouts
- Article preview on hover
- Export graph as image
- Dark/light theme toggle
