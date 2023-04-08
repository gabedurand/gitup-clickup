#! /usr/bin/env node

import prompts from "prompts";
import ax from "axios";
import os from "os";
import fs from "fs";
import { execSync, exec } from "child_process";
import shell from "shelljs";

const USERHOMEDIR = os.homedir();
const CONFIGFILE = USERHOMEDIR + "/.gitup-clickup.json";

// config file template - do not edit
const defaultConfig = {
  token: "",
  teamId: null,
  spaceId: null,
  folderId: null,
  lastTaskId: null,
  lastTaskTitle: null,
};

function isGitInstalled() {
  try {
    execSync("git --version", { stdio: "ignore" });
    return true;
  } catch (e) {
    return false;
  }
}

// gitcu --reset
function resetConfigFile() {
  fs.unlinkSync(CONFIGFILE);
}

function updateConfigFile(config) {
  // get current config
  const currentConfig = JSON.parse(fs.readFileSync(CONFIGFILE, "utf8"));
  // update config
  const newConfig = { ...currentConfig, ...config };
  // write new config
  fs.writeFileSync(CONFIGFILE, JSON.stringify(newConfig));
}

const onCancel = () => {
  console.log("exiting GitUp-ClickUp...");
  process.exit();
};

const callCUAPI = async (ax, endpoint, id, folder, reverse = false) => {
  const cmd = await ax.get(
    `${endpoint}/${id}/${folder}?archived=false&subtasks=true&reverse=${reverse}`
  );

  let results = cmd.data;

  return results;
};

const getAllCUTasks = async (ax, endpoint, id, list, reverse = false) => {
  const cmd = await ax.get(
    `${endpoint}/${id}/${list}?archived=false&subtasks=true&reverse=${reverse}`
  );

  let results = cmd.data;

  return results;
};
function orderTasksByParent(tasks) {
  // Create a map of parent tasks
  const parentTasks = new Map();
  tasks.forEach((task) => {
    if (task.parent === null) {
      parentTasks.set(task.id, [task]);
    } else {
      const parent = parentTasks.get(task.parent);
      if (parent) {
        // Add "--" prefix to subtask names
        task.title = `-- ${task.title} (${task.status.status})`;
        parent.push(task);
      } else {
        parentTasks.set(task.parent, [task]);
      }
    }
  });

  // Flatten the map into an ordered array
  const orderedTasks = [];
  parentTasks.forEach((subtasks) => {
    orderedTasks.push(...subtasks);
  });

  return orderedTasks;
}

(async () => {
  let TOKEN;
  let CONFIG;
  let TEAMID;
  let SELECTEDTASKID;
  let SELECTEDTASKTITLE;
  let SELECTEDTASKSTATUS;

  // get command line arguments
  const args = process.argv.slice(2);
  const command = args[0];

  if (command == "--reset") {
    resetConfigFile();
    console.log("Config file has been removed");
    process.exit();
  }

  // create a command line box

  console.log("/-------------------\\");
  console.log("|   GitUp-ClickUp   |");
  console.log("\\-------------------/");

  // check operating system if git is installed
  const testGitInstall = isGitInstalled();
  if (!testGitInstall) {
    console.log("Git is not installed");
    process.exit(1);
  }

  if (!fs.existsSync(CONFIGFILE)) {
    // prompt for token
    const tokenPrompt = await prompts(
      [
        {
          type: "password",
          name: "value",
          message: "Enter ClickUp API Token",
          validate: (value) =>
            value.length > 0 ? true : "Please enter a valid token",
        },
      ],
      { onCancel }
    );

    // write config file
    fs.writeFileSync(CONFIGFILE, JSON.stringify(defaultConfig));
    defaultConfig.token = tokenPrompt.value;
    TOKEN = tokenPrompt.value;
    updateConfigFile(defaultConfig);
  } else {
    CONFIG = JSON.parse(fs.readFileSync(CONFIGFILE, "utf8"));
    TOKEN = CONFIG.token;
  }

  ax.defaults.baseURL = "https://api.clickup.com/api/v2/";
  ax.defaults.headers.common["Authorization"] = TOKEN;

  // check if default team is set
  let selectedTeamId = CONFIG?.teamId ? CONFIG.teamId : null;
  if (!CONFIG?.teamId) {
    const listTeams = await ax.get("team");
    const teams = listTeams.data.teams;

    const teamChoices = teams.map((s) => ({ title: s.name, value: s.id }));
    const selectTeam = await prompts(
      [
        {
          type: "select",
          name: "value",
          message: "Pick Team",
          choices: teamChoices,
          initial: 0,
        },
      ],
      { onCancel }
    );
    selectedTeamId = selectTeam.value;
    // prompt to save as default team ID
    const saveTeamPrompt = await prompts(
      [
        {
          type: "confirm",
          name: "value",
          message: "Save as default team?",
          initial: true,
        },
      ],
      { onCancel }
    );
    // if yes, update config file
    if (saveTeamPrompt.value) {
      updateConfigFile({ teamId: selectedTeamId });
    }
  } else {
    TEAMID = CONFIG.teamId;
  }

  // check if default space is set
  let selectedSpaceId = CONFIG?.spaceId ? CONFIG.spaceId : null;

  if (selectedTeamId && !selectedSpaceId) {
    const listSpaces = await callCUAPI(ax, "team", selectedTeamId, "space");
    const spaces = listSpaces.spaces;
    const spaceChoices = spaces.map((s) => ({ title: s.name, value: s.id }));
    const selectSpace = await prompts(
      [
        {
          type: "select",
          name: "value",
          message: "Pick Space",
          choices: spaceChoices,
          initial: 0,
        },
      ],
      { onCancel }
    );
    selectedSpaceId = selectSpace.value;

    // prompt to save as default space ID
    const saveSpacePrompt = await prompts(
      [
        {
          type: "confirm",
          name: "value",
          message: "Save as default space?",
          initial: true,
        },
      ],
      { onCancel }
    );
    // if yes, update config file
    if (saveSpacePrompt.value) {
      updateConfigFile({ spaceId: selectedSpaceId });
    }
  }

  // check for previous task id in config file
  let usePreviousTask = false;

  // prompt to use previous task id
  if (CONFIG?.lastTaskId) {
    const usePrevTaskPrompt = await prompts(
      [
        {
          type: "confirm",
          name: "value",
          message: "Use previous task: '" + CONFIG.lastTaskTitle + "'?",
          initial: true,
        },
      ],
      { onCancel }
    );
    if (usePrevTaskPrompt.value) {
      usePreviousTask = true;
    }
  }

  // if not using previous task, prompt to select task
  if (!usePreviousTask) {
    // clear previous task id from config file
    updateConfigFile({ lastTaskId: null, lastTaskTitle: null });

    // get all folders in space
    let listFolders = await callCUAPI(ax, "space", selectedSpaceId, "folder");
    let { folders } = listFolders;

    let folderLists = [];

    folders.forEach((folder) => folderLists.push(...folder.lists));

    // get all list in space
    let listLists = await callCUAPI(ax, "space", selectedSpaceId, "list");
    let lists = listLists.lists;

    const folderChoices = folderLists.map((s) => ({
      title: s.name + " (Folder)",
      value: s.id,
    }));

    const listChoices = lists.map((l) => ({
      title: l.name + " (List)",
      value: l.id,
    }));

    const selectFolderOrList = await prompts(
      [
        {
          type: "select",
          name: "value",
          message: "Select",
          choices: [...folderChoices, ...listChoices],
          initial: 0,
        },
      ],
      { onCancel }
    );

    const taskList = await callCUAPI(
      ax,
      "list",
      selectFolderOrList.value,
      "task",
      true
    );

    //  const taskList = await ax.get(TASKURL);

    const tasks = taskList.tasks;

    if (!tasks.length) onCancel();

    const tasksChoices = tasks.map((s) => ({
      id: s.id,
      title: s.name,
      value: s.id,
      status: s.status,
      parent: s.parent,
    }));

    // reorder array put parent and its subtasks together
    const reorderTasks = orderTasksByParent(tasksChoices);

    const selectTask = await prompts(
      [
        {
          type: "select",
          name: "value",
          message: "Pick Task",
          choices: reorderTasks,
          initial: 0,
        },
      ],
      { onCancel }
    );

    SELECTEDTASKTITLE = tasksChoices.find(
      (task) => task.id === selectTask.value
    ).title;
    SELECTEDTASKID = selectTask.value;
    // save as last task in config
    updateConfigFile({ lastTaskId: SELECTEDTASKID });
    // save last task title in config
    updateConfigFile({ lastTaskTitle: SELECTEDTASKTITLE });
  } else {
    SELECTEDTASKTITLE = CONFIG.lastTaskTitle;
    SELECTEDTASKID = CONFIG.lastTaskId;
  }

  // prompt to update task status
  const updateStatusPrompt = await prompts(
    [
      {
        type: "confirm",
        name: "value",
        message: "Update task status?",
        initial: true,
      },
    ],
    { onCancel }
  );
  // if yes, prompt a list of statuses to choose from
  if (updateStatusPrompt.value) {
    const statusChoices = [
      {
        title: "Open",
        value: "open",
      },
      {
        title: "In Progress",
        value: "in progress",
      },
      {
        title: "Closed",
        value: "closed",
      },
    ];
    const selectStatus = await prompts(
      [
        {
          type: "select",
          name: "value",
          message: "Pick Status",
          choices: statusChoices,
          initial: 0,
        },
      ],
      { onCancel }
    );
    SELECTEDTASKSTATUS = selectStatus.value;
  }

  // save as previous taskid in config
  updateConfigFile({ lastTaskId: SELECTEDTASKID });

  shell.exec(`git add .`);
  // prompt for commit message
  const commitPrompt = await prompts(
    [
      {
        type: "text",
        name: "value",
        message: "Commit Message for " + SELECTEDTASKTITLE,
        initial: "Commit Message",
      },
    ],
    { onCancel }
  );

  let COMMITMESSAGE;

  if (SELECTEDTASKSTATUS) {
    COMMITMESSAGE =
      "CU-" +
      SELECTEDTASKID +
      "[" +
      SELECTEDTASKSTATUS +
      "]" +
      " " +
      commitPrompt.value;
  } else {
    COMMITMESSAGE = "CU-" + SELECTEDTASKID + " " + commitPrompt.value;
  }

  shell.exec(`git commit -m "${COMMITMESSAGE}"`);
  console.log("commit message saved.");

  const pushCommit = await prompts(
    [
      {
        type: "confirm",
        name: "value",
        message: "Push Commit?",
        initial: true,
      },
    ],
    { onCancel }
  );

  if (pushCommit) {
    shell.exec("git push origin HEAD");
  }
})();
