import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder } from 'obsidian';

interface PaperlibIntegrationSettings {
	paperNotesFolder: string;
	paperNoteTemplate: string;
	protocolHandlerEnabled: boolean;
}

const DEFAULT_SETTINGS: PaperlibIntegrationSettings = {
	paperNotesFolder: 'papers',
	paperNoteTemplate: '---\n\ntitle: {{title}}\nauthors: {{authors}}\nyear: {{year}}\ndoi: {{doi}}\n---\n\n# {{title}}\n\n## Summary\n\n## Notes\n\n',
	protocolHandlerEnabled: true
}

export default class PaperlibIntegration extends Plugin {
	settings: PaperlibIntegrationSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		// const ribbonIconEl = this.addRibbonIcon('file-text', 'PaperLib Integration', (evt: MouseEvent) => {
		// 	// Called when the user clicks the icon.
		// 	new Notice('PaperLib Integration is active');
		// });

		// Register protocol handler for paperlib:// URLs
		if (this.settings.protocolHandlerEnabled) {
			// 只注册一个协议处理器，避免冲突
			this.registerObsidianProtocolHandler('paperlib', async (params) => {
				console.log('Received PaperLib protocol request:', params);

				// Extract paper information from the URL parameters
				const { id, title, authors, year, doi } = params;

				if (!id) {
					new Notice('Error: No paper ID provided');
					return;
				}

				// Create or open the paper note
				try {
					await this.createOrOpenPaperNote(id, title, authors, year, doi);
					new Notice(`Successfully opened paper: ${title || id}`);
				} catch (error) {
					console.error('Error handling paperlib protocol:', error);
					new Notice(`Error opening paper: ${error.message || error}`);
				}
			});

			// 注册一个自定义的协议处理器，避免与内置的 'open' 处理器冲突
			this.registerObsidianProtocolHandler('paperlib-open', async (params) => {
				console.log('Received paperlib-open protocol request:', params);

				// 处理所有可能的参数格式

				// 检查是否有 path 参数
				if (params.path) {
					const paperName = params.path.replace(/^paperlib\//, '');
					console.log(`Attempting to open paper from path: ${paperName}`);

					try {
						await this.createOrOpenPaperNote(paperName, paperName);
						new Notice(`Successfully opened paper: ${paperName}`);
						return;
					} catch (error) {
						console.error('Error handling path parameter:', error);
						new Notice(`Error opening paper: ${error.message || error}`);
					}
				}

				// 检查是否有 vault 和 file 参数
				if (params.vault && params.file) {
					const paperName = decodeURIComponent(params.file);
					console.log(`Attempting to open paper from vault/file: ${paperName}`);

					try {
						await this.createOrOpenPaperNote(paperName, paperName);
						new Notice(`Successfully opened paper: ${paperName}`);
						return;
					} catch (error) {
						console.error('Error handling vault/file parameters:', error);
						new Notice(`Error opening paper: ${error.message || error}`);
					}
				}

				// 检查是否有 id 或其他元数据参数
				if (params.id || (params.title && params.authors)) {
					const { id, title, authors, year, doi } = params;
					const paperId = id || title || 'unknown';
					console.log(`Attempting to open paper from metadata: ${paperId}`);

					try {
						await this.createOrOpenPaperNote(paperId, title, authors, year, doi);
						new Notice(`Successfully opened paper: ${title || paperId}`);
						return;
					} catch (error) {
						console.error('Error handling metadata parameters:', error);
						new Notice(`Error opening paper: ${error.message || error}`);
					}
				}

				// 如果没有识别到任何参数
				new Notice('Error: Could not recognize parameters in the URL');
				console.error('Unrecognized parameters:', params);
			});
		}

		// Add a command to manually create a paper note
		this.addCommand({
			id: 'create-paper-note',
			name: 'Create new paper note',
			callback: () => {
				new PaperNoteModal(this.app, this).open();
			}
		});

		// Add a command to open the papers folder
		this.addCommand({
			id: 'open-papers-folder',
			name: 'Open papers folder',
			callback: async () => {
				const folderPath = this.settings.paperNotesFolder;
				const folder = this.app.vault.getAbstractFileByPath(folderPath);

				if (folder && folder instanceof TFolder) {
					// Open the folder in the file explorer
					const firstChild = folder.children[0];
					if (firstChild instanceof TFile) {
						this.app.workspace.getLeaf().openFile(firstChild);
						new Notice(`Opened papers folder: ${folderPath}`);
					} else {
						new Notice(`No file found in papers folder: ${folderPath}`);
					}
				} else {
					new Notice(`Papers folder not found: ${folderPath}`);
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new PaperlibSettingTab(this.app, this));
	}

	onunload() {
		console.log('PaperLib Integration plugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async ensurePapersFolderExists() {
		const folderPath = this.settings.paperNotesFolder;

		// Check if the folder path is valid
		if (!folderPath || folderPath.trim() === '') {
			new Notice('Please enter a valid folder path');
			return false;
		}

		try {
			// Check if the folder already exists
			const folder = this.app.vault.getAbstractFileByPath(folderPath);

			if (folder) {
				// Folder already exists
				if (folder instanceof TFolder) {
					console.log(`Papers folder already exists: ${folderPath}`);
					return true;
				} else {
					// Path exists but is not a folder
					new Notice(`Error: ${folderPath} exists but is not a folder`);
					return false;
				}
			} else {
				// Create the folder
				await this.app.vault.createFolder(folderPath);
				console.log(`Created papers folder: ${folderPath}`);
				return true;
			}
		} catch (error) {
			console.error(`Error creating papers folder: ${error}`);
			new Notice(`Error creating papers folder: ${error}`);
			return false;
		}
	}

	async createOrOpenPaperNote(id: string, title?: string, authors?: string, year?: string, doi?: string) {
		const sanitizedId = this.sanitizeFilename(id);
		const sanitizedTitle = title ? this.sanitizeFilename(title) : sanitizedId;

		// Ensure the papers folder exists before creating a note
		const folderExists = await this.ensurePapersFolderExists();
		if (!folderExists) {
			new Notice('Cannot create paper note: Papers folder does not exist');
			return;
		}

		// Create the file path
		const filePath = `${this.settings.paperNotesFolder}/${sanitizedTitle}.md`;

		// Check if the file already exists
		let file = this.app.vault.getAbstractFileByPath(filePath);

		// If the file doesn't exist, create it
		if (!file) {
			// Generate the note content from the template
			let content = this.settings.paperNoteTemplate;
			content = content.replace(/{{title}}/g, title || 'Untitled Paper');
			content = content.replace(/{{authors}}/g, authors || '');
			content = content.replace(/{{year}}/g, year || '');
			content = content.replace(/{{doi}}/g, doi || '');
			content = content.replace(/{{id}}/g, id);

			try {
				file = await this.app.vault.create(filePath, content);
				new Notice(`Created new paper note: ${sanitizedTitle}`);
			} catch (error) {
				console.error(`Error creating paper note: ${error}`);
				new Notice(`Error creating paper note: ${error}`);
				return;
			}
		} else {
			new Notice(`Opening existing paper note: ${sanitizedTitle}`);
		}

		// Open the file
		if (file instanceof TFile) {
			await this.app.workspace.getLeaf().openFile(file);
		}
	}

	// Helper function to sanitize filenames
	sanitizeFilename(name: string): string {
		return name.replace(/[\\/:*?"<>|]/g, '-');
	}
}

class PaperNoteModal extends Modal {
	plugin: PaperlibIntegration;
	titleInput: HTMLInputElement;
	authorsInput: HTMLInputElement;
	yearInput: HTMLInputElement;
	doiInput: HTMLInputElement;
	idInput: HTMLInputElement;

	constructor(app: App, plugin: PaperlibIntegration) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.createEl('h2', {text: 'Create New Paper Note'});

		// Paper ID (required)
		contentEl.createEl('label', {text: 'Paper ID (required)'}).appendChild(
			this.idInput = document.createElement('input')
		);
		this.idInput.type = 'text';
		this.idInput.value = '';
		this.idInput.placeholder = 'Unique identifier for the paper';
		contentEl.createEl('br');

		// Paper Title
		contentEl.createEl('label', {text: 'Title'}).appendChild(
			this.titleInput = document.createElement('input')
		);
		this.titleInput.type = 'text';
		this.titleInput.value = '';
		this.titleInput.placeholder = 'Paper title';
		contentEl.createEl('br');

		// Authors
		contentEl.createEl('label', {text: 'Authors'}).appendChild(
			this.authorsInput = document.createElement('input')
		);
		this.authorsInput.type = 'text';
		this.authorsInput.value = '';
		this.authorsInput.placeholder = 'Paper authors';
		contentEl.createEl('br');

		// Year
		contentEl.createEl('label', {text: 'Year'}).appendChild(
			this.yearInput = document.createElement('input')
		);
		this.yearInput.type = 'text';
		this.yearInput.value = '';
		this.yearInput.placeholder = 'Publication year';
		contentEl.createEl('br');

		// DOI
		contentEl.createEl('label', {text: 'DOI'}).appendChild(
			this.doiInput = document.createElement('input')
		);
		this.doiInput.type = 'text';
		this.doiInput.value = '';
		this.doiInput.placeholder = 'Digital Object Identifier';
		contentEl.createEl('br');

		// Create button
		const createButton = contentEl.createEl('button', {text: 'Create Note'});
		createButton.addEventListener('click', async () => {
			const id = this.idInput.value.trim();
			if (!id) {
				new Notice('Paper ID is required');
				return;
			}

			await this.plugin.createOrOpenPaperNote(
				id,
				this.titleInput.value.trim(),
				this.authorsInput.value.trim(),
				this.yearInput.value.trim(),
				this.doiInput.value.trim()
			);
			this.close();
		});
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class PaperlibSettingTab extends PluginSettingTab {
	plugin: PaperlibIntegration;

	constructor(app: App, plugin: PaperlibIntegration) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		containerEl.createEl('h2', {text: 'PaperLib Integration Settings'});

		new Setting(containerEl)
			.setName('Papers Folder')
			.setDesc('The folder where paper notes will be stored. Press Enter or click Create to create the folder.')
			.addText(text => {
				const textComponent = text
					.setPlaceholder('Papers')
					.setValue(this.plugin.settings.paperNotesFolder)
					.onChange(async (value) => {
						this.plugin.settings.paperNotesFolder = value;
						await this.plugin.saveSettings();
					});

				// Get the HTML input element
				const inputEl = textComponent.inputEl;

				// Add event listener for the Enter key
				inputEl.addEventListener('keydown', async (event: KeyboardEvent) => {
					if (event.key === 'Enter') {
						event.preventDefault();
						const success = await this.plugin.ensurePapersFolderExists();
						if (success) {
							new Notice(`Folder created/verified: ${this.plugin.settings.paperNotesFolder}`);
						}
						inputEl.blur(); // Remove focus from the input
					}
				});

				return textComponent;
			})
			.addButton(button => button
				.setButtonText('Create')
				.onClick(async () => {
					const success = await this.plugin.ensurePapersFolderExists();
					if (success) {
						new Notice(`Folder created/verified: ${this.plugin.settings.paperNotesFolder}`);
					}
				}));

		new Setting(containerEl)
			.setName('Note Template')
			.setDesc('Template for new paper notes. Use {{title}}, {{authors}}, {{year}}, {{doi}}, and {{id}} as placeholders.')
			.addTextArea(text => text
				.setPlaceholder('Enter your template')
				.setValue(this.plugin.settings.paperNoteTemplate)
				.onChange(async (value) => {
					this.plugin.settings.paperNoteTemplate = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Enable Protocol Handler')
			.setDesc('Allow opening notes directly from PaperLib using the paperlib:// protocol')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.protocolHandlerEnabled)
				.onChange(async (value) => {
					this.plugin.settings.protocolHandlerEnabled = value;
					await this.plugin.saveSettings();
					new Notice('Please restart Obsidian for this change to take effect');
				}));
	}
}
