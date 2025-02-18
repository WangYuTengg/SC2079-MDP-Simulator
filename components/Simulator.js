import React from "react";
import { useState, useEffect } from "react";
import QueryAPI from "./QueryAPI";

const Direction = {
  NORTH: 0,
  EAST: 2,
  SOUTH: 4,
  WEST: 6,
  SKIP: 8,
};

const ObDirection = {
  NORTH: 0,
  EAST: 2,
  SOUTH: 4,
  WEST: 6,
  SKIP: 8,
};

const DirectionToString = {
  0: "Up",
  2: "Right",
  4: "Down",
  6: "Left",
  8: "None",
};

const transformCoord = (x, y) => {
  // Change the coordinate system from (0, 0) at top left to (0, 0) at bottom left
  return { x: 19 - y, y: x };
};

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function Simulator() {
  const [robotState, setRobotState] = useState({
    x: 1,
    y: 1,
    d: Direction.NORTH,
    s: -1,
  });
  const [timer, setTimer] = useState(0);
  const [toggleAuto, setToggleAuto] = useState(false);
  const [robotX, setRobotX] = useState(1);
  const [robotY, setRobotY] = useState(1);
  const [robotDir, setRobotDir] = useState(0);
  const [obstacles, setObstacles] = useState([]);
  const [obXInput, setObXInput] = useState(0);
  const [obYInput, setObYInput] = useState(0);
  const [directionInput, setDirectionInput] = useState(ObDirection.NORTH);
  const [isComputing, setIsComputing] = useState(false);
  const [path, setPath] = useState([]);
  const [commands, setCommands] = useState([]);
  const [page, setPage] = useState(0);

  const generateNewID = () => {
    while (true) {
      let new_id = Math.floor(Math.random() * 10) + 1; // just try to generate an id;
      let ok = true;
      for (const ob of obstacles) {
        if (ob.id === new_id) {
          ok = false;
          break;
        }
      }
      if (ok) {
        return new_id;
      }
    }
  };

  const generateRobotCells = () => {
    const robotCells = [];
    let markerX = 0;
    let markerY = 0;

    if (Number(robotState.d) === Direction.NORTH) {
      markerY++;
    } else if (Number(robotState.d) === Direction.EAST) {
      markerX++;
    } else if (Number(robotState.d) === Direction.SOUTH) {
      markerY--;
    } else if (Number(robotState.d) === Direction.WEST) {
      markerX--;
    }

    // Go from i = -1 to i = 1
    for (let i = -1; i < 2; i++) {
      // Go from j = -1 to j = 1
      for (let j = -1; j < 2; j++) {
        // Transform the coordinates to our coordinate system where (0, 0) is at the bottom left
        const coord = transformCoord(robotState.x + i, robotState.y + j);
        // If the cell is the marker cell, add the robot state to the cell
        if (markerX === i && markerY === j) {
          robotCells.push({
            x: coord.x,
            y: coord.y,
            d: robotState.d,
            s: robotState.s,
          });
        } else {
          robotCells.push({
            x: coord.x,
            y: coord.y,
            d: null,
            s: -1,
          });
        }
      }
    }
    return robotCells;
  };

  const getCommandDuration = (command) => {
    const lower = command.toLowerCase();

    // Handle forward/backward commands (e.g. FW10/BW80)
    if (lower.startsWith("fw") || lower.startsWith("bw")) {
      const num = parseInt(command.substring(2), 10);
      return isNaN(num) ? 1 : num / 20; // e.g. FW10 takes 0.5 seconds
    } else if (lower.startsWith("fin")) {
      return 0;
    }

    // All other commands (e.g. turns and snaps)
    return 3;
  };

  const getCumulativeTime = (stepIndex) => {
    let time = 0;
    for (let i = 0; i < stepIndex; i++) {
      time += getCommandDuration(commands[i] || "");
    }
    return time;
  };

  const onChangeX = (event) => {
    if (Number.isInteger(Number(event.target.value))) {
      const nb = Number(event.target.value);
      if (0 <= nb && nb < 20) {
        setObXInput(nb);
        return;
      }
    }
    setObXInput(0);
  };

  const onChangeY = (event) => {
    if (Number.isInteger(Number(event.target.value))) {
      const nb = Number(event.target.value);
      if (0 <= nb && nb <= 19) {
        setObYInput(nb);
        return;
      }
    }
    setObYInput(0);
  };

  const onChangeRobotX = (event) => {
    if (Number.isInteger(Number(event.target.value))) {
      const nb = Number(event.target.value);
      if (1 <= nb && nb < 19) {
        setRobotX(nb);
        return;
      }
    }
    setRobotX(1);
  };

  const onChangeRobotY = (event) => {
    if (Number.isInteger(Number(event.target.value))) {
      const nb = Number(event.target.value);
      if (1 <= nb && nb < 19) {
        setRobotY(nb);
        return;
      }
    }
    setRobotY(1);
  };

  const onClickObstacle = () => {
    if (!obXInput && !obYInput) return;
    const newObstacles = [...obstacles];
    newObstacles.push({
      x: obXInput,
      y: obYInput,
      d: directionInput,
      id: generateNewID(),
    });
    setObstacles(newObstacles);
  };

  const onClickRobot = () => {
    setRobotState({ x: robotX, y: robotY, d: robotDir, s: -1 });
  };

  const onDirectionInputChange = (event) => {
    setDirectionInput(Number(event.target.value));
  };

  const onRobotDirectionInputChange = (event) => {
    setRobotDir(event.target.value);
  };

  const onRemoveObstacle = (ob) => {
    if (path.length > 0 || isComputing) return;
    const newObstacles = [];
    for (const o of obstacles) {
      if (o.x === ob.x && o.y === ob.y) continue;
      newObstacles.push(o);
    }
    setObstacles(newObstacles);
  };

  const compute = () => {
    setIsComputing(true);
    QueryAPI.query(obstacles, robotX, robotY, robotDir, (data, err) => {
      if (data) {
        setPath(data.data.path);
        const cmds = [];
        for (let x of data.data.commands) {
          if (x.startsWith("SNAP")) continue;
          cmds.push(x);
        }
        setCommands(cmds);
      }
      setIsComputing(false);
    });
  };

  const onResetAll = () => {
    setRobotX(1);
    setRobotDir(0);
    setRobotY(1);
    setRobotState({ x: 1, y: 1, d: Direction.NORTH, s: -1 });
    setPath([]);
    setCommands([]);
    setPage(0);
    setObstacles([]);
  };

  const onReset = () => {
    setRobotX(1);
    setRobotDir(0);
    setRobotY(1);
    setRobotState({ x: 1, y: 1, d: Direction.NORTH, s: -1 });
    setPath([]);
    setCommands([]);
    setPage(0);
  };

  const renderGrid = () => {
    const rows = [];
    const baseStyle = {
      width: 25,
      height: 25,
      borderStyle: "solid",
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      padding: 0,
    };

    const robotCells = generateRobotCells();

    for (let i = 0; i < 20; i++) {
      const cells = [
        <td key={`header-${i}`} className="w-5 h-5 md:w-8 md:h-8">
          <span className="text-sky-900 font-bold text-[0.6rem] md:text-base ">{19 - i}</span>
        </td>,
      ];

      for (let j = 0; j < 20; j++) {
        let foundOb = null;
        let foundRobotCell = null;

        for (const ob of obstacles) {
          const transformed = transformCoord(ob.x, ob.y);
          if (transformed.x === i && transformed.y === j) {
            foundOb = ob;
            break;
          }
        }

        if (!foundOb) {
          for (const cell of robotCells) {
            if (cell.x === i && cell.y === j) {
              foundRobotCell = cell;
              break;
            }
          }
        }

        if (foundOb) {
          if (foundOb.d === Direction.WEST) {
            cells.push(
              <td
                key={`ob-${i}-${j}`}
                className="border border-l-4 border-l-red-500 w-5 h-5 md:w-8 md:h-8 bg-blue-700"
              />
            );
          } else if (foundOb.d === Direction.EAST) {
            cells.push(
              <td
                key={`ob-${i}-${j}`}
                className="border border-r-4 border-r-red-500 w-5 h-5 md:w-8 md:h-8 bg-blue-700"
              />
            );
          } else if (foundOb.d === Direction.NORTH) {
            cells.push(
              <td
                key={`ob-${i}-${j}`}
                className="border border-t-4 border-t-red-500 w-5 h-5 md:w-8 md:h-8 bg-blue-700"
              />
            );
          } else if (foundOb.d === Direction.SOUTH) {
            cells.push(
              <td
                key={`ob-${i}-${j}`}
                className="border border-b-4 border-b-red-500 w-5 h-5 md:w-8 md:h-8 bg-blue-700"
              />
            );
          } else if (foundOb.d === Direction.SKIP) {
            cells.push(<td key={`ob-${i}-${j}`} className="border w-5 h-5 md:w-8 md:h-8 bg-blue-700" />);
          }
        } else if (foundRobotCell) {
          cells.push(
            <td
              key={`robot-${i}-${j}`}
              className={`border w-5 h-5 md:w-8 md:h-8 ${foundRobotCell.s !== -1 ? "bg-red-500" : "bg-yellow-300"}`}
            />
          );
        } else if (i >= 17 && j < 3) {
          cells.push(
            <td key={`start-${i}-${j}`} className="border border-purple w-5 h-5 md:w-8 md:h-8 bg-indigo-200" />
          );
        } else {
          cells.push(<td key={`empty-${i}-${j}`} className="border-black border w-5 h-5 md:w-8 md:h-8" />);
        }
      }

      rows.push(<tr key={`row-${i}`}>{cells}</tr>);
    }

    const yAxis = [<td key="axis-empty" />];
    for (let i = 0; i < 20; i++) {
      yAxis.push(
        <td key={`axis-${i}`} className="w-5 h-5 md:w-8 md:h-8">
          <span className="text-sky-900 font-bold text-[0.6rem] md:text-base ">{i}</span>
        </td>
      );
    }
    rows.push(<tr key="yAxis">{yAxis}</tr>);
    return rows;
  };

  useEffect(() => {
    setTimer(getCumulativeTime(page));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, commands]);

  useEffect(() => {
    if (page >= path.length) return;
    setRobotState(path[page]);
  }, [page, path]);

  // Auto simulation: when toggleAuto is enabled, automatically increment the page.
  useEffect(() => {
    if (toggleAuto && path.length > 0 && page < path.length - 1) {
      const timeout = setTimeout(() => {
        setPage(page + 1);
      }, getCommandDuration(commands[page]) * 800);
      return () => clearTimeout(timeout);
    }
  }, [toggleAuto, page, path, commands]);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="flex flex-col items-center text-center bg-sky-200 rounded-xl shadow-xl mb-8">
        <h2 className="card-title text-black pt-4">Algorithm Simulator</h2>
      </div>
      <div className="flex flex-col items-center text-center bg-sky-200 rounded-xl shadow-xl">
        <div className="card-body items-center text-center p-4">
          <h2 className="card-title text-black">Robot Position</h2>
          <div className="form-control">
            <label className="input-group input-group-horizontal">
              <span className="bg-primary p-2">X</span>
              <input
                onChange={onChangeRobotX}
                type="number"
                placeholder="1"
                min="1"
                max="18"
                className="input input-bordered text-blue-900 w-20"
              />
              <span className="bg-primary p-2">Y</span>
              <input
                onChange={onChangeRobotY}
                type="number"
                placeholder="1"
                min="1"
                max="18"
                className="input input-bordered text-blue-900 w-20"
              />
              <span className="bg-primary p-2">D</span>
              <select
                onChange={onRobotDirectionInputChange}
                value={robotDir}
                className="select text-blue-900 py-2 pl-2 pr-6"
              >
                <option value={ObDirection.NORTH}>Up</option>
                <option value={ObDirection.SOUTH}>Down</option>
                <option value={ObDirection.WEST}>Left</option>
                <option value={ObDirection.EAST}>Right</option>
              </select>
              <button className="btn btn-success p-2" onClick={onClickRobot}>
                Set
              </button>
            </label>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center text-center bg-sky-200 p-4 rounded-xl shadow-xl m-8">
        <h2 className="card-title text-black pb-2">Add Obstacles</h2>
        <div className="form-control">
          <label className="input-group input-group-horizontal">
            <span className="bg-primary p-2">X</span>
            <input
              onChange={onChangeX}
              type="number"
              placeholder="1"
              min="0"
              max="19"
              className="input input-bordered text-blue-900 w-20"
            />
            <span className="bg-primary p-2">Y</span>
            <input
              onChange={onChangeY}
              type="number"
              placeholder="1"
              min="0"
              max="19"
              className="input input-bordered text-blue-900 w-20"
            />
            <span className="bg-primary p-2">D</span>
            <select
              onChange={onDirectionInputChange}
              value={directionInput}
              className="select text-blue-900 py-2 pl-2 pr-6"
            >
              <option value={ObDirection.NORTH}>Up</option>
              <option value={ObDirection.SOUTH}>Down</option>
              <option value={ObDirection.WEST}>Left</option>
              <option value={ObDirection.EAST}>Right</option>
              <option value={ObDirection.SKIP}>None</option>
            </select>
            <button className="btn btn-success p-2" onClick={onClickObstacle}>
              Add
            </button>
          </label>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-x-2 gap-y-4 items-center">
        {obstacles.map((ob) => {
          return (
            <div
              key={ob.id}
              className="badge flex flex-row text-black bg-sky-100 rounded-xl text-xs md:text-sm h-max border-cyan-500"
            >
              <div>
                <div>X: {ob.x}</div>
                <div>Y: {ob.y}</div>
                <div>D: {DirectionToString[ob.d]}</div>
              </div>
              <div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="inline-block w-4 h-4 stroke-current"
                  onClick={() => onRemoveObstacle(ob)}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </div>
            </div>
          );
        })}
      </div>
      <div className="btn-group btn-group-horizontal py-4">
        <button className="btn btn-error" onClick={onResetAll}>
          Reset All
        </button>
        <button className="btn btn-warning" onClick={onReset}>
          Reset Robot
        </button>
        <button className="btn btn-success" onClick={compute}>
          Submit
        </button>
        {/* Styled toggle switch */}
        <label className="flex items-center cursor-pointer ml-4">
          <div className="relative">
            <input
              type="checkbox"
              className="hidden"
              checked={toggleAuto}
              onChange={() => setToggleAuto(!toggleAuto)}
            />
            <div className="w-10 h-4 bg-gray-400 rounded-full shadow-inner"></div>
            <div
              className={`dot absolute w-6 h-6 bg-white rounded-full shadow -left-1 -top-1 transition ${
                toggleAuto ? "transform translate-x-full bg-green-500" : ""
              }`}
            ></div>
          </div>
          <div className="ml-3 text-gray-700 font-medium">Auto Simulation: {toggleAuto ? "ON" : "OFFED"}</div>
        </label>
      </div>
      {path.length > 0 && (
        <div className="flex flex-row items-center text-center bg-sky-200 p-4 rounded-xl shadow-xl my-8">
          <button
            className="btn btn-circle pt-2 pl-1"
            disabled={page === 0}
            onClick={() => {
              setPage(page - 1);
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"
              />
            </svg>
          </button>

          <span className="mx-5 text-black">
            Step: {page + 1} / {path.length}
          </span>
          <span className="mx-5 text-black">{commands[page]}</span>
          <span className="mx-5 text-black">Time: {timer} seconds</span>
          <button
            className="btn btn-circle pt-2 pl-2"
            disabled={page === path.length - 1 || toggleAuto === true}
            onClick={() => {
              setPage(page + 1);
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"
              />
            </svg>
          </button>
        </div>
      )}
      {toggleAuto && commands.length > 0 && <div><h3>Simulation in progress</h3></div>}{" "}
      <table className="border-collapse border-none border-black ">
        <tbody>{renderGrid()}</tbody>
      </table>
    </div>
  );
}
