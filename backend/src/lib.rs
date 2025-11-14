#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, Map, String, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Bet {
    pub id: u64,
    pub question: String,
    pub options: Vec<String>,
    pub oracle: Address,
    pub is_resolved: bool,
    pub winning_option: Option<u32>,
    pub total_pot: i128,
    pub stakes: Map<Address, (u32, i128)>,
}

#[contracttype]
enum DataKey {
    NextBetId,
    Bets,
}

#[contract]
pub struct BettingContract;

#[contractimpl]
impl BettingContract {
    /// Initializes the contract and sets the next bet ID to 1.
    pub fn initialize(env: Env) {
        env.storage().instance().set(&DataKey::NextBetId, &1u64);
    }

    /// Creates a new bet.
    /// # Arguments
    /// * `oracle` - The address that can resolve this bet.
    /// * `question` - The question of the bet.
    /// * `options` - A vector of possible outcomes.
    /// # Returns
    /// The ID of the newly created bet.
    pub fn create_bet(env: Env, oracle: Address, question: String, options: Vec<String>) -> u64 {
        oracle.require_auth();

        let bet_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextBetId)
            .unwrap_or(1u64);

        let bet = Bet {
            id: bet_id,
            question,
            options,
            oracle,
            is_resolved: false,
            winning_option: None,
            total_pot: 0,
            stakes: Map::new(&env),
        };

        let mut bets: Map<u64, Bet> = env.storage().instance().get(&DataKey::Bets).unwrap_or(Map::new(&env));
        bets.set(bet_id, bet);
        env.storage().instance().set(&DataKey::Bets, &bets);
        env.storage().instance().set(&DataKey::NextBetId, &(bet_id + 1));

        bet_id
    }

    /// Places a bet on a specific option.
    /// # Arguments
    /// * `bettor` - The address placing the bet.
    /// * `bet_id` - The ID of the bet to place a stake on.
    /// * `option_index` - The index of the option to bet on.
    /// * `amount` - The amount to stake.
    /// * `token_address` - The address of the token being used for betting.
    pub fn place_bet(
        env: Env,
        bettor: Address,
        bet_id: u64,
        option_index: u32,
        amount: i128,
        token_address: Address,
    ) {
        bettor.require_auth();

        let mut bets: Map<u64, Bet> = env.storage().instance().get(&DataKey::Bets).expect("Bets not initialized");
        let mut bet = bets.get(bet_id).expect("Bet not found");

        assert!(!bet.is_resolved, "Bet is already resolved");
        assert!(option_index < bet.options.len(), "Invalid option index");
        assert!(!bet.stakes.contains_key(bettor.clone()), "Bettor has already placed a bet");

        let token = token::Client::new(&env, &token_address);
        token.transfer(&bettor, &env.current_contract_address(), &amount);

        bet.stakes.set(bettor.clone(), (option_index, amount));
        bet.total_pot += amount;
        bets.set(bet_id, bet);
        env.storage().instance().set(&DataKey::Bets, &bets);
    }

    /// Resolves a bet and sets the winning option.
    /// # Arguments
    /// * `oracle` - The oracle address authorized to resolve the bet.
    /// * `bet_id` - The ID of the bet to resolve.
    /// * `winning_option_index` - The index of the winning option.
    pub fn resolve_bet(env: Env, oracle: Address, bet_id: u64, winning_option_index: u32) {
        let mut bets: Map<u64, Bet> = env.storage().instance().get(&DataKey::Bets).expect("Bets not initialized");
        let mut bet = bets.get(bet_id).expect("Bet not found");
        
        oracle.require_auth();
        assert!(oracle == bet.oracle, "Not the oracle for this bet");
        assert!(!bet.is_resolved, "Bet is already resolved");
        assert!(winning_option_index < bet.options.len(), "Invalid winning option index");

        bet.is_resolved = true;
        bet.winning_option = Some(winning_option_index);
        bets.set(bet_id, bet);
        env.storage().instance().set(&DataKey::Bets, &bets);
    }

    /// Allows a winner to claim their portion of the pot.
    /// # Arguments
    /// * `claimer` - The address of the user claiming their winnings.
    /// * `bet_id` - The ID of the bet from which to claim.
    /// * `token_address` - The address of the token used for betting.
    pub fn claim_winnings(env: Env, claimer: Address, bet_id: u64, token_address: Address) {
        claimer.require_auth();

        let mut bets: Map<u64, Bet> = env.storage().instance().get(&DataKey::Bets).expect("Bets not initialized");
        let mut bet = bets.get(bet_id).expect("Bet not found");

        assert!(bet.is_resolved, "Bet is not yet resolved");

        let claimer_stake = bet.stakes.get(claimer.clone()).expect("Claimer did not place a bet");
        let winning_option = bet.winning_option.expect("Winning option not set");

        if claimer_stake.0 == winning_option {
            let mut total_winning_stake = 0;
            for (_, (option, stake)) in bet.stakes.iter() {
                if option == winning_option {
                    total_winning_stake += stake;
                }
            }

            if total_winning_stake > 0 {
                let payout = (claimer_stake.1 * bet.total_pot) / total_winning_stake;
                let token = token::Client::new(&env, &token_address);
                token.transfer(&env.current_contract_address(), &claimer, &payout);
            }
        } else {
            // If they didn't win, they get nothing.
        }

        // Remove the claimer from the stakes map to prevent double-claiming.
        bet.stakes.remove(claimer.clone());
        bets.set(bet_id, bet);
        env.storage().instance().set(&DataKey::Bets, &bets);
    }

    // --- Getter Functions for Frontend ---

    /// Returns a specific bet by its ID.
    pub fn get_bet(env: Env, bet_id: u64) -> Option<Bet> {
        let bets: Map<u64, Bet> = env.storage().instance().get(&DataKey::Bets).unwrap_or(Map::new(&env));
        bets.get(bet_id)
    }

    /// Returns the total number of bets created.
    pub fn get_bets_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::NextBetId).unwrap_or(1u64) - 1
    }
}
