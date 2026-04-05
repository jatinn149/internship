import { AvatarProfile, CosmosUser, Position, ServerUserState } from "../types/user";
import { WORLD_HEIGHT, WORLD_WIDTH } from "../utils/constants";
import { generatePreferredSpawnPosition } from "../utils/spawnRooms";

export interface RemovedUserState {
  userId: string;
  position: Position;
  connectedUsers: string[];
}

export interface ChatRoomSnapshot {
  roomId: string | null;
  memberUserIds: string[];
}

const PROXIMITY_ROOM_PREFIX = "proximity-room-";

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

export class CosmosState {
  private readonly usersBySocket = new Map<string, ServerUserState>();
  private readonly socketByUser = new Map<string, string>();
  private readonly roomByUser = new Map<string, string>();
  private readonly roomMembersById = new Map<string, Set<string>>();
  private usersSnapshotCache: CosmosUser[] = [];
  private isUsersSnapshotDirty = true;
  private roomSequence = 1;

  private markUsersSnapshotDirty(): void {
    this.isUsersSnapshotDirty = true;
  }

  public hasUserId(userId: string): boolean {
    return this.socketByUser.has(userId);
  }

  public static isManagedRoom(roomId: string): boolean {
    return roomId.startsWith(PROXIMITY_ROOM_PREFIX);
  }

  public normalizePosition(position?: Position): Position {
    const nextPosition = position ?? { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };

    return {
      x: clamp(nextPosition.x, 0, WORLD_WIDTH),
      y: clamp(nextPosition.y, 0, WORLD_HEIGHT),
    };
  }

  public createSpawnPosition(): Position {
    const existingPositions = Array.from(this.usersBySocket.values()).map((user) => user.position);
    return this.normalizePosition(generatePreferredSpawnPosition(existingPositions));
  }

  public addUser(
    socketId: string,
    userId: string,
    displayName: string,
    avatar: AvatarProfile,
    position: Position
  ): ServerUserState {
    const userState: ServerUserState = {
      socketId,
      userId,
      displayName,
      avatar,
      position: this.normalizePosition(position),
      connectedUsers: new Set<string>(),
      lastBroadcastAt: 0,
    };

    this.usersBySocket.set(socketId, userState);
    this.socketByUser.set(userId, socketId);
    this.markUsersSnapshotDirty();
    return userState;
  }

  public listUserIds(): string[] {
    return Array.from(this.socketByUser.keys());
  }

  public getUserBySocket(socketId: string): ServerUserState | undefined {
    return this.usersBySocket.get(socketId);
  }

  public getUserByUserId(userId: string): ServerUserState | undefined {
    const socketId = this.socketByUser.get(userId);
    if (!socketId) {
      return undefined;
    }

    return this.usersBySocket.get(socketId);
  }

  public getSocketIdByUserId(userId: string): string | undefined {
    return this.socketByUser.get(userId);
  }

  public listUsers(): CosmosUser[] {
    if (!this.isUsersSnapshotDirty) {
      return this.usersSnapshotCache;
    }

    this.usersSnapshotCache = Array.from(this.usersBySocket.values()).map((user) => ({
      id: user.userId,
      displayName: user.displayName,
      avatar: user.avatar,
      x: user.position.x,
      y: user.position.y,
    }));
    this.isUsersSnapshotDirty = false;
    return this.usersSnapshotCache;
  }

  public updatePosition(socketId: string, position: Position): { user: ServerUserState; changed: boolean } | undefined {
    const user = this.usersBySocket.get(socketId);
    if (!user) {
      return undefined;
    }

    const nextPosition = this.normalizePosition(position);
    const changed = user.position.x !== nextPosition.x || user.position.y !== nextPosition.y;

    if (changed) {
      user.position = nextPosition;
      this.markUsersSnapshotDirty();
    }

    return {
      user,
      changed,
    };
  }

  public removeUser(socketId: string): RemovedUserState | undefined {
    const user = this.usersBySocket.get(socketId);
    if (!user) {
      return undefined;
    }

    this.usersBySocket.delete(socketId);
    this.socketByUser.delete(user.userId);
    this.roomByUser.delete(user.userId);
    this.markUsersSnapshotDirty();

    user.connectedUsers.forEach((peerUserId) => {
      const peer = this.getUserByUserId(peerUserId);
      peer?.connectedUsers.delete(user.userId);
    });

    return {
      userId: user.userId,
      position: user.position,
      connectedUsers: Array.from(user.connectedUsers),
    };
  }

  public connectUsers(userA: string, userB: string): boolean {
    const first = this.getUserByUserId(userA);
    const second = this.getUserByUserId(userB);

    if (!first || !second) {
      return false;
    }

    if (first.connectedUsers.has(userB) && second.connectedUsers.has(userA)) {
      return false;
    }

    first.connectedUsers.add(userB);
    second.connectedUsers.add(userA);
    return true;
  }

  public disconnectUsers(userA: string, userB: string): boolean {
    const first = this.getUserByUserId(userA);
    const second = this.getUserByUserId(userB);

    if (!first || !second) {
      return false;
    }

    const changed = first.connectedUsers.delete(userB);
    second.connectedUsers.delete(userA);
    return changed;
  }

  public areUsersConnected(userA: string, userB: string): boolean {
    const first = this.getUserByUserId(userA);
    return first?.connectedUsers.has(userB) ?? false;
  }

  public getRoomIdByUserId(userId: string): string | undefined {
    return this.roomByUser.get(userId);
  }

  public getRoomMembers(roomId: string): string[] {
    const members = this.roomMembersById.get(roomId);
    if (!members) {
      return [];
    }

    return Array.from(members).sort((first, second) => first.localeCompare(second));
  }

  public getChatSnapshotForUser(userId: string): ChatRoomSnapshot {
    const roomId = this.getRoomIdByUserId(userId);
    if (!roomId) {
      return {
        roomId: null,
        memberUserIds: [],
      };
    }

    return {
      roomId,
      memberUserIds: this.getRoomMembers(roomId),
    };
  }

  public reconcileRooms(): void {
    const previousRoomByUser = new Map(this.roomByUser);
    this.roomByUser.clear();
    this.roomMembersById.clear();

    const visited = new Set<string>();

    this.listUserIds().forEach((userId) => {
      if (visited.has(userId)) {
        return;
      }

      const component = this.collectConnectedComponent(userId, visited);
      if (component.length < 2) {
        return;
      }

      const roomId = this.resolveRoomId(component, previousRoomByUser);
      const members = new Set(component.sort((first, second) => first.localeCompare(second)));

      this.roomMembersById.set(roomId, members);
      members.forEach((memberUserId) => {
        this.roomByUser.set(memberUserId, roomId);
      });
    });
  }

  private collectConnectedComponent(startUserId: string, visited: Set<string>): string[] {
    const queue: string[] = [startUserId];
    const component: string[] = [];
    visited.add(startUserId);

    while (queue.length > 0) {
      const currentUserId = queue.shift();
      if (!currentUserId) {
        continue;
      }

      const currentUser = this.getUserByUserId(currentUserId);
      if (!currentUser) {
        continue;
      }

      component.push(currentUserId);

      currentUser.connectedUsers.forEach((peerUserId) => {
        if (visited.has(peerUserId)) {
          return;
        }

        if (!this.getUserByUserId(peerUserId)) {
          return;
        }

        visited.add(peerUserId);
        queue.push(peerUserId);
      });
    }

    return component;
  }

  private resolveRoomId(component: string[], previousRoomByUser: Map<string, string>): string {
    const roomFrequency = new Map<string, number>();

    component.forEach((memberUserId) => {
      const previousRoomId = previousRoomByUser.get(memberUserId);
      if (!previousRoomId) {
        return;
      }

      roomFrequency.set(previousRoomId, (roomFrequency.get(previousRoomId) ?? 0) + 1);
    });

    if (roomFrequency.size > 0) {
      const sortedCandidates = Array.from(roomFrequency.entries()).sort((first, second) => {
        if (first[1] !== second[1]) {
          return second[1] - first[1];
        }

        return first[0].localeCompare(second[0]);
      });

      return sortedCandidates[0][0];
    }

    return this.createRoomId();
  }

  private createRoomId(): string {
    let roomId = `${PROXIMITY_ROOM_PREFIX}${this.roomSequence}`;
    this.roomSequence += 1;

    while (this.roomMembersById.has(roomId)) {
      roomId = `${PROXIMITY_ROOM_PREFIX}${this.roomSequence}`;
      this.roomSequence += 1;
    }

    return roomId;
  }
}
