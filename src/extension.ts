import * as vscode from 'vscode';
import { detectWorktree } from './worktree-detector';
import { generatePalette, hexToHue, ColorConfig } from './color-generator';
import { getConfig } from './config';
import { applyColors, resetColors } from './theme-applier';
import { formatStatusBarText } from './status-bar';
import { validateHexColor } from './color-picker';

const RANDOM_OVERRIDE_KEY = 'worktreeColors.randomOverride';
let statusBarItem: vscode.StatusBarItem | undefined;

async function runPipeline(context: vscode.ExtensionContext): Promise<void> {
	const folders = vscode.workspace.workspaceFolders;
	if (!folders || folders.length === 0) {
		return;
	}

	const workspacePath = folders[0].uri.fsPath;
	const vsConfig = vscode.workspace.getConfiguration('worktreeColors');
	const config = getConfig(vsConfig);

	if (!config.enabled) {
		return;
	}

	const worktreeInfo = await detectWorktree(workspacePath);
	if (!worktreeInfo) {
		return;
	}

	if (!worktreeInfo.isWorktree && !config.colorizeNonWorktree) {
		return;
	}

	// Check for randomize override
	const randomOverride = context.globalState.get<string>(RANDOM_OVERRIDE_KEY);
	const identifier = randomOverride ?? worktreeInfo.identifier;

	const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark
		|| vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrast;

	const customHex = config.customColors[identifier];
	const hueOverride = customHex ? Math.round(hexToHue(customHex) * 360) : undefined;

	const colorConfig: ColorConfig = {
		saturation: config.saturation,
		lightness: isDark ? config.lightness : config.lightnessLight,
		isDark,
		hueOverride,
	};

	const palette = generatePalette(identifier, colorConfig);
	const workbenchConfig = vscode.workspace.getConfiguration('workbench');
	await applyColors(palette, config.colorTargets, workbenchConfig, vscode.ConfigurationTarget.Workspace);

	// Update status bar indicator
	if (statusBarItem) {
		statusBarItem.text = formatStatusBarText(identifier);
		statusBarItem.backgroundColor = undefined;
		statusBarItem.tooltip = `Worktree: ${identifier} (${palette['titleBar.activeBackground']})`;
		statusBarItem.show();
	}
}

export function activate(context: vscode.ExtensionContext): void {
	// Create status bar item
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBarItem.command = 'worktreeColors.refresh';
	context.subscriptions.push(statusBarItem);

	// Run pipeline on activation
	runPipeline(context);

	// Re-run when color theme changes
	context.subscriptions.push(
		vscode.window.onDidChangeActiveColorTheme(() => {
			runPipeline(context);
		})
	);

	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand('worktreeColors.refresh', () => {
			runPipeline(context);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('worktreeColors.reset', async () => {
			const vsConfig = vscode.workspace.getConfiguration('worktreeColors');
			const config = getConfig(vsConfig);
			const workbenchConfig = vscode.workspace.getConfiguration('workbench');
			await resetColors(config.colorTargets, workbenchConfig, vscode.ConfigurationTarget.Workspace);
			await context.globalState.update(RANDOM_OVERRIDE_KEY, undefined);
			if (statusBarItem) { statusBarItem.hide(); }
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('worktreeColors.randomize', async () => {
			const randomId = `random-${Date.now()}-${Math.random().toString(36).slice(2)}`;
			await context.globalState.update(RANDOM_OVERRIDE_KEY, randomId);
			await runPipeline(context);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('worktreeColors.pickColor', async () => {
			const hex = await vscode.window.showInputBox({
				prompt: 'Enter a hex color for this worktree (e.g. #ff0000)',
				placeHolder: '#ff0000',
				validateInput: validateHexColor,
			});
			if (!hex) { return; }

			const hue = Math.round(hexToHue(hex) * 360);
			const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark
				|| vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrast;
			const vsConfig = vscode.workspace.getConfiguration('worktreeColors');
			const config = getConfig(vsConfig);

			const colorConfig: ColorConfig = {
				saturation: config.saturation,
				lightness: isDark ? config.lightness : config.lightnessLight,
				isDark,
				hueOverride: hue,
			};

			const folders = vscode.workspace.workspaceFolders;
			if (!folders || folders.length === 0) { return; }
			const worktreeInfo = await detectWorktree(folders[0].uri.fsPath);
			const identifier = worktreeInfo?.identifier ?? 'workspace';

			const palette = generatePalette(identifier, colorConfig);
			const workbenchConfig = vscode.workspace.getConfiguration('workbench');
			await applyColors(palette, config.colorTargets, workbenchConfig, vscode.ConfigurationTarget.Workspace);

			if (statusBarItem) {
				statusBarItem.text = formatStatusBarText(identifier);
				statusBarItem.tooltip = `Worktree: ${identifier} (${palette['titleBar.activeBackground']})`;
				statusBarItem.show();
			}
		})
	);
}

export function deactivate(): void {
	// Nothing to clean up
}
