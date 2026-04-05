import { useCallback, useMemo, useState } from "react";
import { CosmosCanvas } from "../canvas/CosmosCanvas";
import { ChatPanel } from "../components/ChatPanel";
import { GameArenaPanel } from "../components/GameArenaPanel";
import { InnovationHubPanel } from "../components/InnovationHubPanel";
import { JoinDialog } from "../components/JoinDialog";
import { SocialVoicePanel } from "../components/SocialVoicePanel";
import { SpaceSidebar } from "../components/SpaceSidebar";
import { SpaceTopBar } from "../components/SpaceTopBar";
import { useCosmosSocket } from "../hooks/useCosmosSocket";
import { useInnovationHub } from "../hooks/useInnovationHub";
import { useMovement } from "../hooks/useMovement";
import { useProximity } from "../hooks/useProximity";
import { useSocialLoungeVoice } from "../hooks/useSocialLoungeVoice";
import { RoomId } from "../types/room";
import { AvatarProfile, CosmosUser, JoinIdentity, Position } from "../types/user";
import { WORLD_HEIGHT, WORLD_WIDTH } from "../utils/constants";
import { COSMOS_ROOMS, getRoomByPosition } from "../utils/rooms";

const INITIAL_POSITION: Position = {
  x: WORLD_WIDTH / 2,
  y: WORLD_HEIGHT / 2,
};

const DEFAULT_AVATAR: AvatarProfile = {
  gender: "male",
  skinTone: "medium",
  outfitColor: "azure",
  hairStyle: "short",
};

interface UserWithRoom extends CosmosUser {
  roomId: RoomId;
  roomName: string;
}

export const CosmosPage = () => {
  const [identity, setIdentity] = useState<JoinIdentity | null>(null);
  const [spawnPosition, setSpawnPosition] = useState<Position>(INITIAL_POSITION);

  const handleJoined = useCallback((position: Position) => {
    setSpawnPosition(position);
  }, []);

  const {
    socket,
    selfUserId,
    users,
    messages,
    arenaGame,
    arenaLobby,
    emitMove,
    sendMessage,
    challengeArenaPlayer,
    respondToArenaChallenge,
    leaveArenaMatch,
    sendArenaAction,
  } = useCosmosSocket(identity, handleJoined);

  const { position } = useMovement({
    initialPosition: spawnPosition,
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    onMove: selfUserId ? emitMove : undefined,
  });

  const handleIdentitySubmit = useCallback((nextIdentity: JoinIdentity) => {
    setIdentity(nextIdentity);
  }, []);

  const renderUsers = useMemo(() => {
    if (!selfUserId) {
      return users;
    }

    const selfFromServer = users.find((user) => user.id === selfUserId);
    const others = users.filter((user) => user.id !== selfUserId);
    return [
      ...others,
      {
        id: selfUserId,
        displayName: selfFromServer?.displayName || identity?.displayName || selfUserId,
        avatar: selfFromServer?.avatar || identity?.avatar || DEFAULT_AVATAR,
        x: position.x,
        y: position.y,
      },
    ];
  }, [users, selfUserId, position, identity]);

  const currentRoom = useMemo(() => {
    return getRoomByPosition(position).room;
  }, [position]);

  const usersWithRooms = useMemo<UserWithRoom[]>(() => {
    return renderUsers.map((user) => {
      const room = getRoomByPosition(user).room;
      return {
        ...user,
        roomId: room.id,
        roomName: room.name,
      };
    });
  }, [renderUsers]);

  const selfDisplayName = useMemo(() => {
    if (!selfUserId) {
      return identity?.displayName || null;
    }

    return renderUsers.find((user) => user.id === selfUserId)?.displayName || identity?.displayName || selfUserId;
  }, [identity, renderUsers, selfUserId]);

  const arenaPlayers = useMemo(() => {
    return usersWithRooms
      .filter((user) => user.roomId === "game-arena")
      .map((user) => ({
        id: user.id,
        displayName: user.displayName,
      }));
  }, [usersWithRooms]);

  const socialLoungeUsers = useMemo(() => {
    return usersWithRooms
      .filter((user) => user.roomId === "social-lounge")
      .map((user) => ({
        id: user.id,
        displayName: user.displayName,
      }));
  }, [usersWithRooms]);

  const { isVoiceSupported, micEnabled, isTogglingMic, voiceError, voiceEnabledUserIds, speakingUserIds, toggleMic } =
    useSocialLoungeVoice({
      socket,
      selfUserId,
      currentRoomId: currentRoom.id,
    });

  const {
    innovationState,
    isPresenter,
    isPitchMicToggling,
    pitchVoiceError,
    isPitchVoiceSupported,
    startSharing,
    stopSharing,
    togglePitchMic,
    sendWhiteboardStroke,
    clearWhiteboard,
    addIdea,
    toggleIdeaVote,
  } = useInnovationHub({
    socket,
    selfUserId,
  });

  const userDisplayNameById = useMemo(() => {
    return Object.fromEntries(usersWithRooms.map((user) => [user.id, user.displayName]));
  }, [usersWithRooms]);

  const socialVoiceParticipants = useMemo(() => {
    return voiceEnabledUserIds.map((userId) => {
      const matchedUser = usersWithRooms.find((user) => user.id === userId);

      return {
        id: userId,
        displayName: matchedUser?.displayName || userId,
      };
    });
  }, [usersWithRooms, voiceEnabledUserIds]);

  const { connectedPeerIds, activePeerId, activeRoomId, setActivePeerId } = useProximity({
    socket,
    selfUserId,
    users: renderUsers,
    selfPosition: position,
  });

  const visibleMessages = useMemo(() => {
    if (!activeRoomId) {
      return [];
    }

    return messages.filter((message) => message.roomId === activeRoomId);
  }, [messages, activeRoomId]);

  const handleSendMessage = useCallback(
    (text: string) => {
      if (!activeRoomId) {
        return;
      }

      sendMessage(activeRoomId, text);
    },
    [activeRoomId, sendMessage]
  );

  return (
    <main className="h-screen overflow-hidden bg-cosmos-900 text-slate-100">
      {!identity ? <JoinDialog onSubmit={handleIdentitySubmit} /> : null}

      <div className="mx-auto h-full w-full max-w-[1700px] p-3 lg:p-4">
        <div className="grid h-full gap-3 lg:grid-cols-[minmax(0,1fr)_350px] lg:gap-4 xl:grid-cols-[260px_minmax(0,1fr)_350px]">
          <SpaceSidebar rooms={COSMOS_ROOMS} activeRoomId={currentRoom.id} users={usersWithRooms} />

          <section className="flex min-h-0 flex-col gap-3 lg:gap-4">
            <SpaceTopBar
              selfLabel={selfDisplayName}
              onlineCount={renderUsers.length}
              nearbyCount={connectedPeerIds.length}
              currentRoomName={currentRoom.name}
            />

            <div className="min-h-0 flex-1 rounded-2xl border border-cosmos-700/60 bg-cosmos-800/35 p-2 shadow-panel">
              <CosmosCanvas
                users={renderUsers}
                selfUserId={selfUserId}
                worldWidth={WORLD_WIDTH}
                worldHeight={WORLD_HEIGHT}
              />
            </div>

            <section className="shrink-0 rounded-2xl border border-cosmos-700/60 bg-cosmos-800/45 p-3 shadow-panel">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span className="rounded-full border border-cosmos-700/70 bg-cosmos-900/70 px-3 py-1">
                  Move: WASD / Arrow Keys
                </span>
                <span className="rounded-full border border-cosmos-700/70 bg-cosmos-900/70 px-3 py-1">
                  Chat: Proximity Trigger
                </span>
                {COSMOS_ROOMS.map((room) => (
                  <span
                    key={room.id}
                    className={`rounded-full border px-3 py-1 ${
                      room.id === currentRoom.id
                        ? "border-cosmos-300 bg-cosmos-500/20 text-cosmos-200"
                        : "border-cosmos-700/70 bg-cosmos-900/70 text-slate-300"
                    }`}
                  >
                    {room.name}
                  </span>
                ))}
              </div>
            </section>
          </section>

          <aside className="hidden min-h-0 flex-col gap-3 lg:flex lg:gap-4">
            {currentRoom.id === "game-arena" ? (
              <section className="shrink-0">
                <GameArenaPanel
                  selfUserId={selfUserId}
                  arenaPlayers={arenaPlayers}
                  arenaGame={arenaGame}
                  arenaLobby={arenaLobby}
                  onChallengePlayer={challengeArenaPlayer}
                  onRespondChallenge={respondToArenaChallenge}
                  onLeaveMatch={leaveArenaMatch}
                  onAction={sendArenaAction}
                />
              </section>
            ) : null}

            {currentRoom.id === "innovation-hub" ? (
              <section className="min-h-0 shrink-0">
                <InnovationHubPanel
                  selfUserId={selfUserId}
                  userDisplayNameById={userDisplayNameById}
                  innovationState={innovationState}
                  isPresenter={isPresenter}
                  isPitchVoiceSupported={isPitchVoiceSupported}
                  isPitchMicToggling={isPitchMicToggling}
                  pitchVoiceError={pitchVoiceError}
                  onStartSharing={startSharing}
                  onStopSharing={stopSharing}
                  onTogglePitchMic={() => {
                    void togglePitchMic();
                  }}
                  onWhiteboardStroke={sendWhiteboardStroke}
                  onClearWhiteboard={clearWhiteboard}
                  onAddIdea={addIdea}
                  onToggleIdeaVote={toggleIdeaVote}
                />
              </section>
            ) : null}

            {currentRoom.id === "social-lounge" ? (
              <section className="shrink-0">
                <SocialVoicePanel
                  isVoiceSupported={isVoiceSupported}
                  micEnabled={micEnabled}
                  isTogglingMic={isTogglingMic}
                  participants={socialVoiceParticipants}
                  speakingUserIds={speakingUserIds}
                  selfUserId={selfUserId}
                  voiceError={voiceError}
                  onToggleMic={() => {
                    void toggleMic();
                  }}
                />
              </section>
            ) : null}

            <div className="min-h-0 flex-1">
              <ChatPanel
                connectedPeers={connectedPeerIds}
                activePeerId={activePeerId}
                selfUserId={selfUserId}
                messages={visibleMessages}
                onActivePeerChange={setActivePeerId}
                onSendMessage={handleSendMessage}
              />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
};
