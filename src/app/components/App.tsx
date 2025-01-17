// https://stackoverflow.com/questions/65510727/the-matter-js-startcollision-is-not-working
import * as React from 'react';
import Tracking from '../../plugin/tracking';
import Resizer from './Resizer';
import {fromEvent} from 'rxjs';
import {filter, throttleTime} from 'rxjs/operators';
import {mappingKeyEvent} from './../../utils/index';

import Matter from 'matter-js';
import {IPropsElement} from '../interface';

require('dotenv').config();
declare function require(path: string): any;
let Engine = Matter.Engine;
let Render = Matter.Render;
let Body = Matter.Body;
let World = Matter.World;
let Bodies = Matter.Bodies;
let Composite = Matter.Composite;
// let MouseConstraint = Matter.MouseConstraint;
// let Mouse = Matter.Mouse;
let DEBUG = false;

const KeyUI = ({emoji, text, active}: {emoji: string; text: string; active: boolean}) => {
  const borderColor = active ? `border-gray-600` : `border-gray-200`;
  const textColor = active ? `text-gray-600` : `text-gray-400`;
  return (
    <div
      className={`left p-2 w-20 h-12 flex flex-col items-center justify-center rounded-md border-2 ${borderColor} text-xs font-bold ${textColor} duration-200`}
    >
      <p>{emoji}</p>
      <p>{text}</p>
    </div>
  );
};
const App = ({}) => {
  const boxRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const [focus, setFocus] = React.useState(false);
  const [targetState, setTargetState] = React.useState(null);
  const [status, setStatus] = React.useState('STOP');
  const [jump, setJump] = React.useState(false);
  const setupTheme = (elements: IPropsElement[]) => {
    let engine = Engine.create({});
    const themeElement = elements.find((e) => e.id === 'theme');
    let render = Render.create({
      element: boxRef.current,
      engine: engine,
      canvas: canvasRef.current,
      options: {
        width: themeElement.data.width || 300,
        height: themeElement.data.height || 300,
        background: '#50514F',
        wireframes: false,
      },
    });

    const floor = Bodies.rectangle(themeElement.data.width / 2, themeElement.data.height, themeElement.data.width, 10, {
      isStatic: true,
      render: {
        fillStyle: '#dcdcdc',
      },
    });
    const wall1 = Bodies.rectangle(0, themeElement.data.height / 2, 10, themeElement.data.height, {
      isStatic: true,
      render: {
        fillStyle: 'pink',
      },
    });
    const wall2 = Bodies.rectangle(
      themeElement.data.width,
      themeElement.data.height / 2,
      10,
      themeElement.data.height,
      {
        isStatic: true,
        render: {
          fillStyle: 'pink',
        },
      }
    );
    const rectElement = elements.filter((e) => e.id.includes('rect') || e.id.includes('Rect'));
    const rectList = [];

    rectElement.forEach((rect) => {
      let body = Bodies.rectangle(rect.data.x, rect.data.y, rect.data.width, rect.data.height, {
        isStatic: true,
        render: {
          fillStyle: '#dcdcdc',
        },
        // friction: 0,
        friction: 0.7,
        frictionStatic: 10,
        restitution: 0.2,
        slop: 0.2,
      });
      Body.rotate(body, rect.data.rotation ? rect.data.rotation : 0);
      rectList.push(body);
    });
    const targetElement = elements.find((e) => e.id === 'target');
    const target = Bodies.rectangle(
      targetElement.data.x,
      targetElement.data.y,
      targetElement.data.width,
      targetElement.data.height,
      {
        render: {
          fillStyle: 'tomato',
        },
        inertia: Infinity,
        // friction: 0,
        restitution: 0,
      }
    );

    setTargetState(target);
    engine.world.gravity.y = 1.25;
    World.add(engine.world, [floor, wall1, wall2]);
    Engine.run(engine);
    Render.run(render);

    // let mouse = Mouse.create(render.canvas),
    //   mouseConstraint = MouseConstraint.create(engine, {
    //     mouse: mouse,
    //     constraint: {
    //       stiffness: 0.2,
    //       render: {
    //         visible: false,
    //       },
    //     },
    //   });
    Composite.add(engine.world, rectList);
    Composite.add(engine.world, target);
    // Composite.add(engine.world, mouseConstraint);
    // render.mouse = mouse;
  };
  const handleOnClick = () => {
    setFocus(true);
  };
  React.useEffect(() => {
    window.onmessage = (event) => {
      const {type, message} = event.data.pluginMessage;
      if (type === 'track-init-with-data') {
        Tracking.setup(process.env.AMP_KEY, message.UUID);
        Tracking.track('[Open] with data');
      } else if (type === 'track-init-without-data') {
        Tracking.setup(process.env.AMP_KEY, message.UUID);
        Tracking.track('[Open] without data');
      } else if (type === 'init-theme') {
        setTargetState(null);
        setupTheme(message);
        Tracking.track('[Game] setup theme');
      } else if (type === 'remove-theme') {
        setTargetState(null);
        setFocus(false);
        Tracking.track('[Game] remove theme');
      } else if (type === 'update-pos-for-plugin') {
        Matter.Body.set(targetState, 'position', {x: message.x, y: message.y});
      }
    };
  }, [targetState]);
  React.useEffect(() => {
    const logger = setInterval(() => {
      if (status !== 'STOP') {
        const _velocity = {
          x: mappingKeyEvent(status, targetState.area)?.x,
          y: targetState?.velocity?.y + mappingKeyEvent(status, targetState.area)?.y,
        };
        Body.setVelocity(targetState, _velocity);
      }
    }, 1000 / 100);
    return () => {
      clearInterval(logger);
    };
  }, [status, targetState]);
  React.useEffect(() => {
    if (jump) {
      setTimeout(() => {
        setJump(false);
      }, 300);
    }
  }, [jump]);
  React.useEffect(() => {
    const setPosSyncInterval = setInterval(() => {
      if (targetState?.position) {
        parent.postMessage(
          {pluginMessage: {type: 'set-target-pos', pos: {x: targetState?.position?.x, y: targetState?.position?.y}}},
          '*'
        );
      }
    }, 1000 / 100);
    return () => {
      clearInterval(setPosSyncInterval);
    };
  }, [targetState]);
  React.useEffect(() => {
    const keyDowns$ = fromEvent(document, 'keydown')
      .pipe(filter((value: KeyboardEvent) => value.key === 'ArrowLeft' || value.key === 'ArrowRight'))
      .subscribe((value: KeyboardEvent) => {
        setStatus(value.key);
      });
    const keyUps$ = fromEvent(document, 'keyup')
      .pipe(filter((value: KeyboardEvent) => value.key === 'ArrowLeft' || value.key === 'ArrowRight'))
      .subscribe(() => {
        setStatus('STOP');
        Tracking.track('[Game] Stop');
      });
    const jumps$ = fromEvent(document, 'keydown')
      .pipe(
        filter((value: KeyboardEvent) => value.key === 'x'),
        throttleTime(600)
      )
      .subscribe(() => {
        setJump(true);
        Tracking.track('[Game] Jump');
        const _velocity = {
          x: targetState?.velocity?.x + mappingKeyEvent('Up', targetState.area)?.x,
          y: targetState?.velocity?.y + mappingKeyEvent('Up', targetState.area)?.y,
        };
        Body.setVelocity(targetState, _velocity);
      });

    return () => {
      keyDowns$.unsubscribe();
      keyUps$.unsubscribe();
      jumps$.unsubscribe();
    };
  }, [targetState]);

  return (
    <div className="wrapper w-full h-full relative overflow-hidden">
      {!DEBUG && (
        <div className="flex flex-col w-full h-full bg-white items-center justify-center" onClick={handleOnClick}>
          <div className="flex space-x-2 w-full h-full bg-white items-center justify-center">
            {targetState && focus ? (
              <React.Fragment>
                <KeyUI emoji={'👈'} text="Left(←)" active={status === 'ArrowLeft'} />
                <KeyUI emoji={'🦵'} text="Jump(x)" active={jump} />
                <KeyUI emoji={'👉'} text="Right(→)" active={status === 'ArrowRight'} />
              </React.Fragment>
            ) : (
              <div className="text-gray-600 text-sm text-center">
                {targetState ? (
                  <div>✌️ Now, click on this plugin window to start!</div>
                ) : (
                  <div>
                    ☝️ Select element named:{' '}
                    <b>
                      <i>target</i>
                    </b>{' '}
                    on Canvas
                    <br />
                    <p className="text-gray-600 text-xs">
                      <i>(you will need to re-select if already seleted)</i>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex space-x-2 w-full h-8 bg-gray-100 justify-around items-center p-2">
            <a
              className="text-xs text-blue-400 cursor-pointer"
              href="https://www.figma.com/community/file/990163780837139338/Figma-2D-World-Plugin-Template"
              target="_blank"
            >
              Explore examples
            </a>
            <div className="text-xs text-gray-400">Made with ❤️ by Lichin</div>
            <a
              className="text-xs text-blue-400 cursor-pointer"
              href="mailto:designtipstoday@gmail.com?subject=Feature request for Figma plugin 2D World"
              target="_blank"
            >
              Feature request
            </a>
          </div>
        </div>
      )}
      {/* for debug usage */}
      <div
        className="debugger absolute"
        ref={boxRef}
        style={{
          width: 300,
          height: 300,
        }}
      >
        <canvas ref={canvasRef} />
      </div>
      {DEBUG && <Resizer />}
    </div>
  );
};

export default App;
