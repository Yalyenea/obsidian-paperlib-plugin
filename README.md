# Obsidian PaperLib Integration

This plugin enables integration between Obsidian and PaperLib, allowing you to open and manage academic paper notes in Obsidian directly from PaperLib.

## Features

- Creates and manages paper notes in a dedicated folder
- Supports custom note templates with metadata from PaperLib
- Handles the `obsidian://paperlib` protocol to open notes directly from PaperLib
- Provides commands to manually create paper notes and access the papers folder

## Installation

1. Download the plugin from the releases page
2. Extract the zip file into your Obsidian plugins folder
3. Enable the plugin in Obsidian settings

## Usage

### Opening Notes from PaperLib

When you use the PaperLib plugin to open a paper in Obsidian, this plugin will:

1. Create a new note for the paper if it doesn't exist
2. Fill in the note with metadata from PaperLib using your template
3. Open the note in Obsidian

### Manual Note Creation

You can also create paper notes manually in Obsidian:

1. Open the command palette (Ctrl/Cmd + P)
2. Search for "PaperLib: Create new paper note"
3. Fill in the paper details in the modal

## Configuration

### Settings

- **Papers Folder**: The folder where paper notes will be stored
- **Note Template**: Template for new paper notes, with placeholders for paper metadata
- **Enable Protocol Handler**: Allow opening notes directly from PaperLib

### Template Placeholders

You can use the following placeholders in your note template:

- `{{title}}`: The paper title
- `{{authors}}`: The paper authors
- `{{year}}`: The publication year
- `{{doi}}`: The DOI (Digital Object Identifier)
- `{{id}}`: The unique identifier from PaperLib

## Development

```bash
# Clone the repository
git clone https://github.com/yourusername/obsidian-paperlib-plugin.git

# Install dependencies
cd obsidian-paperlib-plugin
npm install

# Build the plugin
npm run build
```

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/paperlib-obsidian-integration/`.

## License

MIT
