import * as GCTAPI from "../apis/gamesCrafters";
import * as GCTAPITypes from "../apis/gamesCrafters/types";
import * as GHAPI from "../apis/gitHub";
import type * as Types from "./types";
import * as Defaults from "../../models/datas/defaultApp";

export const loadGames = async (app: Types.App, payload: { gameType: string; force?: boolean }) => {
    if (!payload.force && Object.keys(app.gameTypes[payload.gameType].games).length && (new Date().getTime() - app.gameTypes[payload.gameType].lastUpdated) / (1000 * 60 * 60 * 24) < 3 * (1000 * 60 * 60 * 24)) return app;
    const dataSource = payload.gameType === "puzzles" ? app.dataSources.onePlayerGameAPI : app.dataSources.twoPlayerGameAPI;
    const games = await GCTAPI.loadGames(dataSource, payload);
    if (!games) return undefined;
    app.gameTypes[payload.gameType].status = games.status;
    for (const game of games.response)
        app.gameTypes[payload.gameType].games[game.gameId] = {
            ...Defaults.defaultGame,
            id: game.gameId,
            name: game.name,
            type: "puzzles",
            status: game.status,
        };
    app.gameTypes[payload.gameType].lastUpdated = new Date().getTime();
    return app;
};

export const loadVariants = async (app: Types.App, payload: { gameType: string; gameId: string; force?: boolean }) => {
    if (!Object.keys(app.gameTypes[payload.gameType].games).length) {
        const updatedApp = await loadGames(app, payload);
        if (updatedApp) app = updatedApp;
        else return undefined;
    }
    if (!payload.force && Object.keys(app.gameTypes[payload.gameType].games[payload.gameId].variants.variants).length && (new Date().getTime() - app.gameTypes[payload.gameType].games[payload.gameId].variants.lastUpdated) / (1000 * 60 * 60 * 24) < 3 * (1000 * 60 * 60 * 24)) return app;
    const baseDataSource = payload.gameType === "puzzles" ? app.dataSources.onePlayerGameAPI : app.dataSources.twoPlayerGameAPI;
    const variants = await GCTAPI.loadVariants(baseDataSource + `/${payload.gameId}`, payload);
    if (!variants) return undefined;
    app.gameTypes[payload.gameType].games[payload.gameId].variants.status = variants.status;
    app.gameTypes[payload.gameType].games[payload.gameId].variants.lastUpdated = new Date().getTime();
    if (payload.gameType === "puzzles") app.gameTypes[payload.gameType].games[payload.gameId].author = (<GCTAPITypes.OnePlayerGameVariants>variants).response.author;
    app.gameTypes[payload.gameType].games[payload.gameId].dateCreated = (<GCTAPITypes.OnePlayerGameVariants>variants).response.dateCreated;
    app.gameTypes[payload.gameType].games[payload.gameId].description = (<GCTAPITypes.OnePlayerGameVariants>variants).response.description;
    app.gameTypes[payload.gameType].games[payload.gameId].instructions = variants.response.instructions;
    for (const variant of variants.response.variants)
        app.gameTypes[payload.gameType].games[payload.gameId].variants.variants[variant.variantId] = {
            id: variant.variantId,
            description: variant.description,
            startPosition: variant.startPosition,
            positions: { ...Defaults.defaultPositions },
            status: variant.status,
        };
    return app;
};

const formatMoves = (source: Array<{ deltaRemoteness: number; move: string; moveValue: string; position: string; positionValue: string; remoteness: number }>) => {
    const target: Types.Moves = { ...Defaults.defaultAvailableMoves };
    if (source.length) target[source[0].move] = { ...source[0], moveValueOpacity: 1 };
    for (let i = 1; i < source.length; i++) {
        target[source[i].move] = { ...source[i], moveValueOpacity: 1 };
        const previousMove = target[source[i - 1].move];
        const currentMove = target[source[i].move];
        if (previousMove.moveValue !== currentMove.moveValue) continue;
        if (previousMove.moveValueOpacity === 0.5) currentMove.moveValueOpacity = 0.5;
        else if (previousMove.deltaRemoteness !== currentMove.deltaRemoteness) currentMove.moveValueOpacity = previousMove.moveValueOpacity - 0.25;
        else currentMove.moveValueOpacity = previousMove.moveValueOpacity;
    }
    return target;
};

const loadPosition = async (app: Types.App, payload: { gameType: string; gameId: string; variantId: string; position: string; force?: boolean }) => {
    const positions = app.gameTypes[payload.gameType].games[payload.gameId].variants.variants[payload.variantId].positions;
    if (!payload.force && positions[payload.position] && (new Date().getTime() - positions[payload.position].lastUpdated) / (1000 * 60 * 60 * 24) < 3 * (1000 * 60 * 60 * 24)) return app;
    const dataSource = payload.gameType === "puzzles" ? `${app.dataSources.onePlayerGameAPI}/${payload.gameId}/${payload.variantId}/${payload.position}` : `${app.dataSources.twoPlayerGameAPI}/${payload.gameId}/variants/${payload.variantId}/positions/${payload.position}`;
    const updatedPosition = await GCTAPI.loadPosition(dataSource);
    if (!updatedPosition) return undefined;
    positions[payload.position] = {
        status: updatedPosition.status,
        lastUpdated: new Date().getTime(),
        availableMoves: formatMoves(updatedPosition.response.moves),
        position: updatedPosition.response.position,
        positionValue: updatedPosition.response.positionValue,
        remoteness: updatedPosition.response.remoteness,
    };
    return app;
};

export const preFetchNextPositions = async (app: Types.App, payload: { gameType: string; gameId: string; variantId: string; position: string }) => {
    const positions = app.gameTypes[payload.gameType].games[payload.gameId].variants.variants[payload.variantId].positions;
    for (const move of Object.values(positions[payload.position].availableMoves)) if (!(move.position in positions)) await loadPosition(app, { ...payload, position: move.position });
    return app;
};

const generateMatchId = (app: Types.App) => {
    const reservedIds = new Set(...app.currentMatch!.players.map((player) => Object.keys(app.users[player].matches)));
    let newId: number;
    do {
        newId = Math.floor(Math.random() * 10000);
    } while (newId in reservedIds);
    return newId;
};

export const initiateMatch = async (
    app: Types.App,
    payload: {
        gameType: string;
        gameId: string;
        variantId: string;
        matchType: string;
        startingPlayerId: string;
    }
) => {
    if (!Object.keys(app.gameTypes[payload.gameType].games).length || !Object.keys(app.gameTypes[payload.gameType].games[payload.gameId].variants.variants).length) {
        const updatedApp = await loadVariants(app, payload);
        if (updatedApp) app = updatedApp;
        else return undefined;
    }
    const game = app.gameTypes[payload.gameType].games[payload.gameId].variants.variants[payload.variantId];
    const updatedApp = await loadPosition(app, { ...payload, position: game.startPosition });
    if (!updatedApp) return undefined;
    app.currentMatch = {
        id: 0,
        gameType: payload.gameType,
        gameId: payload.gameId,
        variantId: payload.variantId,
        type: payload.matchType,
        players: payload.matchType === "pvp" ? ["p1", "p2"] : [],
        startingPlayerId: payload.startingPlayerId,
        rounds: {},
        round: {
            id: 1,
            playerId: payload.startingPlayerId,
            move: "",
            moveValue: "",
            position: game.positions[game.startPosition],
        },
        turn: 0,
        created: new Date().getTime(),
        lastPlayed: new Date().getTime(),
        ended: 0,
    };
    app.currentMatch.id = generateMatchId(app);
    app.currentMatch.rounds[app.currentMatch.round.id] = { ...app.currentMatch.round };
    app.currentMatch.turn = app.currentMatch.players.indexOf(app.currentMatch.startingPlayerId) + 1;
    return app;
};

export const getMaximumRemoteness = (app: Types.App, payload: { from: number; to: number }) => Math.max(...Object.values(app.currentMatch.rounds).map((round) => (round.id >= payload.from && round.id <= payload.to && round.position.positionValue !== "draw" ? round.position.remoteness : 0)));

export const isEndOfMatch = (app: Types.App) => !app.currentMatch.round.position.remoteness && app.currentMatch.round.position.positionValue !== "draw";

export const exitMatch = (app: Types.App) => {
    if (Object.entries(app.currentMatch.rounds).length <= 1) return app;
    app.currentMatch.rounds[app.currentMatch.round.id] = app.currentMatch.round;
    app.currentMatch.lastPlayed = new Date().getTime();
    if (isEndOfMatch(app)) app.currentMatch.ended = new Date().getTime();
    for (const player of app.currentMatch.players) app.users[player].matches[app.currentMatch.id] = app.currentMatch;
    app.currentMatch = { ...Defaults.defaultMatch };
    return app;
};

export const restartMatch = (app: Types.App) => {
    const oldMatch = { ...app.currentMatch };
    app = exitMatch(app);
    app.currentMatch = { ...oldMatch };
    app.currentMatch.id = generateMatchId(app);
    app.currentMatch.startingPlayerId = app.currentMatch.rounds[1].playerId;
    app.currentMatch.round = {
        ...app.currentMatch.rounds[1],
        move: "",
        moveValue: "",
    };
    app.currentMatch.rounds[app.currentMatch.round.id] = { ...app.currentMatch.round };
    app.currentMatch.turn = app.currentMatch.players.indexOf(app.currentMatch.startingPlayerId) + 1;
    app.currentMatch.created = new Date().getTime();
    app.currentMatch.lastPlayed = new Date().getTime();
    app.currentMatch.ended = 0;
    return app;
};

export const runMove = async (app: Types.App, payload: { move: string }) => {
    app.currentMatch.round.move = payload.move;
    app.currentMatch.round.moveValue = app.currentMatch.round.position.availableMoves[payload.move].moveValue;
    app.currentMatch.rounds[app.currentMatch.round.id] = { ...app.currentMatch.round };
    const updatedApp = await loadPosition(app, { gameType: app.currentMatch.gameType, gameId: app.currentMatch.gameId, variantId: app.currentMatch.variantId, position: app.currentMatch.round.position.availableMoves[payload.move].position });
    if (!updatedApp) return undefined;
    const updatedPosition = updatedApp.gameTypes[app.currentMatch.gameType].games[app.currentMatch.gameId].variants.variants[app.currentMatch.variantId].positions[app.currentMatch.round.position.availableMoves[payload.move].position];
    app.currentMatch.turn = app.currentMatch.type === "puzzles" ? 1 : app.currentMatch!.turn === 1 ? 2 : 1;
    app.currentMatch.round.id += 1;
    app.currentMatch.round.playerId = app.currentMatch.players[app.currentMatch.turn - 1];
    app.currentMatch.round.move = "";
    app.currentMatch.round.moveValue = "";
    app.currentMatch.round.position = updatedPosition;
    app.currentMatch.rounds[app.currentMatch.round.id] = { ...app.currentMatch.round };
    app.currentMatch.lastPlayed = new Date().getTime();
    return app;
};

export const undoMove = (app: Types.App) => {
    app.currentMatch.round = { ...app.currentMatch.rounds[app.currentMatch.round.id - 1] };
    app.currentMatch.lastPlayed = new Date().getTime();
    return app;
};

export const redoMove = (app: Types.App) => {
    app.currentMatch.round = { ...app.currentMatch.rounds[app.currentMatch.round.id + 1] };
    app.currentMatch.lastPlayed = new Date().getTime();
    return app;
};

export const loadCommits = async (app: Types.App, payload?: { force?: boolean }) => {
    if (!(payload && payload.force) && Object.keys(app.commits.commits).length && (new Date().getTime() - app.commits.lastUpdated) / (1000 * 60 * 60 * 24) < 3 * (1000 * 60 * 60 * 24)) return app;
    const commits = await GHAPI.loadLatestCommits(app.dataSources.gitHubRepositoryAPI + "/commits");
    if (!commits) return undefined;
    app.commits.lastUpdated = new Date().getTime();
    for (const commit of commits) {
        app.commits.commits[commit.sha] = {
            date: <string>commit.commit.author?.date,
            message: commit.commit.message,
            sha: commit.sha,
            url: commit.html_url,
            authorName: <string>commit.commit.author?.name,
            authorUsername: <string>commit.author?.login,
            authorAvatarUrl: <string>commit.author?.avatar_url,
            authorGitHubUrl: <string>commit.author?.html_url,
        };
    }
    return app;
};
