<h1 align="center"> GitUp-ClickUp </h1> <br>
<p align="center">
  <a href=".">
    <img alt="GitUp-ClickUp" title="GitUp-ClickUp" src="https://s10.gifyu.com/images/gitup-clickup-logo.png" width="200">
  </a>
</p>

<p align="center">
  GitUp-ClickUp is a command-line tool that automates the process of generating commit messages based on tasks in ClickUp, as well as updating task status in ClickUp.
</p>

## Installation

Install the latest version of GitUp-ClickUp with npm (Node 18+)

```bash
  npm install -g gitup-clickup
```

The first time you run GitUp-ClickUp, it will prompt for your ClickUp Personal API Key which will be saved to a local configuration file .gitup-clickup.json stored in your default home directory.

## Configuration

Ensure you have GitHub integrations <a href="https://help.clickup.com/hc/en-us/articles/6305771568791-GitHub-integration">enabled</a> in your ClickUp Workspace and a Personal API Key.

To generate a Personal API Key from ClickUp:

- Navigate to your personal Settings
- Click <strong>Apps</strong> in the left sidebar
- Click <strong>Generate</strong> to create your API token
- Click <strong>Copy</strong> to copy the key to your clipboard

To reset the GitUp-Clickup configuration use the --reset flag:

```bash
  gitcu --reset
```

This will delete the existing configuration file!

## Usage/Examples

When you're ready to push your commit, use the terminal command "gitcu" in your project folder to start GitUp-ClickUp

```bash
gitcu
(select Folder -> Task -> Update Status (optional) -> Commit)
```

GitUp-ClickUp will track your previous choices to make future commits on the same task easier.

## Features

- View your ClickUp Spaces, Folders, Lists and Tasks
- Update a Task status
- Generates and pushes the current branch to your default remote

## Roadmap

- Customized github workflow
- Link multiple tasks to a single commit
- Update Sprint points in ClickUp task
- Update a Task Priority status
- Autocomplete search for tasks
- Submit a PR
- Future GitHub integration (create an issue or release)

## License

[MIT](https://choosealicense.com/licenses/mit/)
