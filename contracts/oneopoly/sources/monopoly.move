module onechain_monopoly::monopoly {
    use one::object::{Self as object, UID};
    use one::transfer;
    use one::tx_context::{Self as tx_context, TxContext};

    // ---------------- Errors ----------------
    const E_GAME_FULL: u64 = 1;
    const E_GAME_STARTED: u64 = 2;
    const E_ALREADY_JOINED: u64 = 3;
    const E_NOT_HOST: u64 = 4;
    const E_NOT_ENOUGH_PLAYERS: u64 = 5;
    const E_NOT_STARTED: u64 = 6;
    const E_NOT_PLAYER: u64 = 7;
    const E_NOT_YOUR_TURN: u64 = 8;
    const E_PLAYER_INACTIVE: u64 = 9;
    const E_BAD_DICE: u64 = 10;

    const E_NOT_ON_POSITION: u64 = 20;
    const E_NOT_PURCHASABLE: u64 = 21;
    const E_ALREADY_OWNED: u64 = 22;
    const E_NOT_OWNER: u64 = 23;
    const E_NO_MONEY: u64 = 24;

    const E_NO_MONOPOLY: u64 = 30;
    const E_MAX_HOTEL: u64 = 31;
    const E_NO_HOUSES: u64 = 32;
    const E_ALREADY_ROLLED: u64 = 41;
    const E_MUST_ROLL: u64 = 42;

    // ---------------- Config ----------------
    const MAX_PLAYERS: u64 = 4;
    const START_MONEY: u64 = 1500;
    const GO_BONUS: u64 = 200;
    const BOARD_SIZE: u8 = 20;

    const ZERO: address = @0x0;

    // ---------------- Models ----------------
    public struct Property has store, drop {
        owner: address,
        price: u64,
        houses: u8, // 0..4 houses, 5 = hotel
        group: u8,
    }

    // NOTE: needs `store` because you call `transfer::public_share_object(game)`
    public struct Game has key, store {
        id: UID,
        game_id: u64,
        host: address,
        started: bool,
        current_player: u64,
        has_rolled: bool,

        // player state (all same index)
        player_addrs: vector<address>,
        pieces: vector<u8>,
        positions: vector<u8>,
        money: vector<u64>,
        active: vector<bool>,

        props: vector<Property>,
    }

    // ---------------- Entry API (reads sender from ctx) ----------------
    public entry fun create_game(game_id: u64, ctx: &mut TxContext) {
        let game = new_game_internal(game_id, ctx);
        transfer::public_share_object(game);
    }

    public entry fun join_game(game: &mut Game, piece: u8, ctx: &mut TxContext) {
        let who = tx_context::sender(ctx);
        join_game_internal(game, who, piece);
    }

    public entry fun start_game(game: &mut Game, ctx: &mut TxContext) {
        let who = tx_context::sender(ctx);
        start_game_internal(game, who);
    }

    public entry fun roll_dice(game: &mut Game, dice1: u8, dice2: u8, ctx: &mut TxContext) {
        let who = tx_context::sender(ctx);
        roll_dice_internal(game, who, dice1, dice2);
    }

    public entry fun next_turn(game: &mut Game, ctx: &mut TxContext) {
        let who = tx_context::sender(ctx);
        require_turn(game, who);
        assert!(game.has_rolled, E_MUST_ROLL);
        next_turn_internal(game);
    }

    public entry fun buy_property(game: &mut Game, pos: u8, ctx: &mut TxContext) {
        let who = tx_context::sender(ctx);
        buy_property_internal(game, who, pos);
    }

    public entry fun buy_house(game: &mut Game, pos: u8, ctx: &mut TxContext) {
        let who = tx_context::sender(ctx);
        buy_house_internal(game, who, pos);
    }

    public entry fun sell_house(game: &mut Game, pos: u8, ctx: &mut TxContext) {
        let who = tx_context::sender(ctx);
        sell_house_internal(game, who, pos);
    }

    // ---------------- Views ----------------
    public fun player_count(game: &Game): u64 { vector::length(&game.player_addrs) }

    public fun property_owner(game: &Game, pos: u8): address {
        let p: &Property = vector::borrow(&game.props, pos as u64);
        p.owner
    }

    public fun property_houses(game: &Game, pos: u8): u8 {
        let p: &Property = vector::borrow(&game.props, pos as u64);
        p.houses
    }

    public fun is_over(game: &Game): bool {
        let n = vector::length(&game.active);
        let mut i: u64 = 0;
        let mut alive: u64 = 0;
        while (i < n) {
            if (*vector::borrow(&game.active, i)) alive = alive + 1;
            i = i + 1;
        };
        alive <= 1
    }

    // ---------------- Internals ----------------
    fun new_game_internal(game_id: u64, ctx: &mut TxContext): Game {
        let host = tx_context::sender(ctx);
        Game {
            id: object::new(ctx),
            game_id,
            host,
            started: false,
            current_player: 0,
            has_rolled: false,

            player_addrs: vector::empty<address>(),
            pieces: vector::empty<u8>(),
            positions: vector::empty<u8>(),
            money: vector::empty<u64>(),
            active: vector::empty<bool>(),

            props: init_properties(),
        }
    }

    fun init_properties(): vector<Property> {
        let mut v = vector::empty<Property>();
        let mut i: u8 = 0;
        while (i < BOARD_SIZE) {
            let price = property_price(i);
            let group = property_group(i);
            vector::push_back(&mut v, Property { owner: ZERO, price, houses: 0, group });
            i = i + 1;
        };
        v
    }

    fun property_price(pos: u8): u64 {
        if (pos == 1) 60
        else if (pos == 2) 60
        else if (pos == 3) 80
        else if (pos == 4) 100
        else if (pos == 6) 140
        else if (pos == 7) 140
        else if (pos == 8) 160
        else if (pos == 9) 180
        else if (pos == 11) 220
        else if (pos == 12) 220
        else if (pos == 13) 240
        else if (pos == 14) 260
        else if (pos == 16) 300
        else if (pos == 17) 300
        else if (pos == 18) 320
        else if (pos == 19) 350
        else 0
    }

    fun property_group(pos: u8): u8 {
        if (pos == 1 || pos == 2) 1
        else if (pos == 3 || pos == 4) 2
        else if (pos == 6 || pos == 7) 3
        else if (pos == 8 || pos == 9) 4
        else if (pos == 11 || pos == 12 || pos == 13) 5
        else if (pos == 16 || pos == 17) 6
        else if (pos == 18 || pos == 19) 7
        else 0
    }

    fun house_cost(_pos: u8): u64 { 50 } // minimal

    fun index_of_player(game: &Game, who: address): u64 {
        let n = vector::length(&game.player_addrs);
        let mut i: u64 = 0;
        while (i < n) {
            if (*vector::borrow(&game.player_addrs, i) == who) return i;
            i = i + 1;
        };
        abort E_NOT_PLAYER
    }

    fun require_turn(game: &Game, who: address) {
        assert!(game.started, E_NOT_STARTED);
        let i = index_of_player(game, who);
        assert!(i == game.current_player, E_NOT_YOUR_TURN);
        assert!(*vector::borrow(&game.active, i), E_PLAYER_INACTIVE);
    }

    fun add_money(game: &mut Game, i: u64, delta: u64) {
        let m: &mut u64 = vector::borrow_mut(&mut game.money, i);
        *m = *m + delta;
    }

    fun sub_money(game: &mut Game, i: u64, delta: u64) {
        let m: &mut u64 = vector::borrow_mut(&mut game.money, i);
        assert!(*m >= delta, E_NO_MONEY);
        *m = *m - delta;
    }

    fun join_game_internal(game: &mut Game, who: address, piece: u8) {
        assert!(!game.started, E_GAME_STARTED);

        let n = vector::length(&game.player_addrs);
        assert!(n < MAX_PLAYERS, E_GAME_FULL);

        // not already joined
        let mut i: u64 = 0;
        while (i < n) {
            assert!(*vector::borrow(&game.player_addrs, i) != who, E_ALREADY_JOINED);
            i = i + 1;
        };

        vector::push_back(&mut game.player_addrs, who);
        vector::push_back(&mut game.pieces, piece);
        vector::push_back(&mut game.positions, 0);
        vector::push_back(&mut game.money, START_MONEY);
        vector::push_back(&mut game.active, true);
    }

    fun start_game_internal(game: &mut Game, who: address) {
        assert!(who == game.host, E_NOT_HOST);
        assert!(!game.started, E_GAME_STARTED);
        assert!(vector::length(&game.player_addrs) >= 2, E_NOT_ENOUGH_PLAYERS);

        game.started = true;
        game.current_player = 0;
    }

    fun roll_dice_internal(game: &mut Game, who: address, dice1: u8, dice2: u8) {
        require_turn(game, who);
        assert!(!game.has_rolled, E_ALREADY_ROLLED);
        assert!(dice1 >= 1 && dice1 <= 6, E_BAD_DICE);
        assert!(dice2 >= 1 && dice2 <= 6, E_BAD_DICE);

        let i = game.current_player;
        let old: u8 = *vector::borrow(&game.positions, i);

        let step: u16 = (dice1 as u16) + (dice2 as u16);
        let mut np: u16 = (old as u16) + step;
        let passed_go = np >= (BOARD_SIZE as u16);
        np = np % (BOARD_SIZE as u16);

        let pos_ref: &mut u8 = vector::borrow_mut(&mut game.positions, i);
        *pos_ref = np as u8;

        if (passed_go) add_money(game, i, GO_BONUS);
        collect_rent_if_needed(game, i);
        game.has_rolled = true;

        if (!*vector::borrow(&game.active, i)) {
            next_turn_internal(game);
        }
    }

    fun next_turn_internal(game: &mut Game) {
        assert!(game.started, E_NOT_STARTED);
        let n = vector::length(&game.player_addrs);
        let mut next = (game.current_player + 1) % n;
        let mut tries: u64 = 0;

        while (tries < n) {
            if (*vector::borrow(&game.active, next)) {
                game.current_player = next;
                game.has_rolled = false;
                return;
            };
            next = (next + 1) % n;
            tries = tries + 1;
        };

        // no active players
        game.current_player = 0;
        game.has_rolled = false;
    }

    fun rent_amount(price: u64, houses: u8): u64 {
        if (price == 0) 0
        else if (houses == 0) price / 10
        else if (houses < 5) (price / 10) * ((houses as u64) + 1)
        else (price / 10) * 10
    }

    fun bankrupt(game: &mut Game, player_i: u64) {
        let who = *vector::borrow(&game.player_addrs, player_i);

        *vector::borrow_mut(&mut game.active, player_i) = false;
        *vector::borrow_mut(&mut game.money, player_i) = 0;

        let mut p: u8 = 0;
        while (p < BOARD_SIZE) {
            let prop: &mut Property = vector::borrow_mut(&mut game.props, p as u64);
            if (prop.owner == who) {
                prop.owner = ZERO;
                prop.houses = 0;
            };
            p = p + 1;
        };

    }

    fun pay_rent_or_bankrupt(game: &mut Game, payer_i: u64, owner_i: u64, rent: u64) {
        let payer_bal = *vector::borrow(&game.money, payer_i);

        if (payer_bal >= rent) {
            sub_money(game, payer_i, rent);
            add_money(game, owner_i, rent);
            return;
        };

        if (payer_bal > 0) {
            *vector::borrow_mut(&mut game.money, payer_i) = 0;
            add_money(game, owner_i, payer_bal);
        };
        bankrupt(game, payer_i);
    }

    fun collect_rent_if_needed(game: &mut Game, mover_i: u64) {
        let pos = *vector::borrow(&game.positions, mover_i);

        let owner: address;
        let price: u64;
        let houses: u8;
        {
            let p: &Property = vector::borrow(&game.props, pos as u64);
            owner = p.owner;
            price = p.price;
            houses = p.houses;
        };

        if (owner == ZERO) return;
        let mover_addr = *vector::borrow(&game.player_addrs, mover_i);
        if (owner == mover_addr) return;

        let rent = rent_amount(price, houses);
        if (rent == 0) return;

        let owner_i = index_of_player(game, owner);
        pay_rent_or_bankrupt(game, mover_i, owner_i, rent);
    }

    fun buy_property_internal(game: &mut Game, who: address, pos: u8) {
        require_turn(game, who);

        let i = index_of_player(game, who);
        let cur: u8 = *vector::borrow(&game.positions, i);
        assert!(cur == pos, E_NOT_ON_POSITION);

        let price: u64;
        {
            let p: &Property = vector::borrow(&game.props, pos as u64);
            assert!(p.price > 0, E_NOT_PURCHASABLE);
            assert!(p.owner == ZERO, E_ALREADY_OWNED);
            price = p.price;
        };

        sub_money(game, i, price);

        {
            let p: &mut Property = vector::borrow_mut(&mut game.props, pos as u64);
            p.owner = who;
        };

    }

    fun has_monopoly(game: &Game, who: address, group: u8): bool {
        let mut found = false;
        let mut pos: u8 = 0;
        while (pos < BOARD_SIZE) {
            let p = vector::borrow(&game.props, pos as u64);
            if (p.price > 0 && p.group == group) {
                found = true;
                if (p.owner != who) return false;
            };
            pos = pos + 1;
        };
        found
    }

    fun buy_house_internal(game: &mut Game, who: address, pos: u8) {
        require_turn(game, who);

        let i = index_of_player(game, who);
        let cur: u8 = *vector::borrow(&game.positions, i);
        assert!(cur == pos, E_NOT_ON_POSITION);

        let group: u8;
        {
            let p: &Property = vector::borrow(&game.props, pos as u64);
            assert!(p.price > 0, E_NOT_PURCHASABLE);
            assert!(p.owner == who, E_NOT_OWNER);
            group = p.group;
        };

        // IMPORTANT: check monopoly BEFORE borrow_mut (fixes your E07002 borrow/freezing issue)
        assert!(has_monopoly(game, who, group), E_NO_MONOPOLY);

        let cost = house_cost(pos);

        let houses_before: u8;
        {
            let p: &Property = vector::borrow(&game.props, pos as u64);
            assert!(p.owner == who, E_NOT_OWNER);
            assert!(p.houses < 5, E_MAX_HOTEL);
            houses_before = p.houses;
        };

        sub_money(game, i, cost);

        if (houses_before < 4) {
            {
                let p: &mut Property = vector::borrow_mut(&mut game.props, pos as u64);
                p.houses = houses_before + 1;
            };
        } else {
            {
                let p: &mut Property = vector::borrow_mut(&mut game.props, pos as u64);
                p.houses = 5;
            };
        };
    }

    fun sell_house_internal(game: &mut Game, who: address, pos: u8) {
        require_turn(game, who);

        let i = index_of_player(game, who);

        let houses_before: u8;
        {
            let p: &Property = vector::borrow(&game.props, pos as u64);
            assert!(p.owner == who, E_NOT_OWNER);
            assert!(p.houses > 0, E_NO_HOUSES);
            houses_before = p.houses;
        };

        if (houses_before == 5) {
            add_money(game, i, 25);

            {
                let p: &mut Property = vector::borrow_mut(&mut game.props, pos as u64);
                p.houses = 4;
            };
        } else {
            add_money(game, i, 25);

            {
                let p: &mut Property = vector::borrow_mut(&mut game.props, pos as u64);
                p.houses = houses_before - 1;
            };
        };
    }

    // ---- test cleanup helper: consume Game without sharing ----
    fun destroy_game(game: Game) {
        let Game {
            id,
            game_id: _,
            host: _,
            started: _,
            current_player: _,
            has_rolled: _,
            player_addrs: _,
            pieces: _,
            positions: _,
            money: _,
            active: _,
            props: _,
        } = game;

        // one/sui-style object deletion for UID
        object::delete(id);
    }

    // ---------------- Tests ----------------
    #[test]
    fun test_flow_basic() {
        use one::test_scenario as ts;

        let p1 = @0x1;
        let p2 = @0x2;
        let mut s = ts::begin(p1);

        let ctx1 = ts::ctx(&mut s);
        let mut game = new_game_internal(12345, ctx1);

        // Player 1 joins
        join_game(&mut game, 0, ctx1);

        // Player 2 joins
        ts::next_tx(&mut s, p2);
        let ctx2 = ts::ctx(&mut s);
        join_game(&mut game, 1, ctx2);

        // Start game by host (p1)
        ts::next_tx(&mut s, p1);
        let ctx3 = ts::ctx(&mut s);
        start_game(&mut game, ctx3);

        // Roll and end turn
        roll_dice(&mut game, 2, 3, ctx3);
        next_turn(&mut game, ctx3);

        // Player 2 turn
        ts::next_tx(&mut s, p2);
        let ctx4 = ts::ctx(&mut s);
        roll_dice(&mut game, 4, 4, ctx4);
        next_turn(&mut game, ctx4);

        assert!(game.started, 1000);
        assert!(player_count(&game) == 2, 1001);

        destroy_game(game);
        ts::end(s);
    }
}
