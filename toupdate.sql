
UPDATE entries SET constituency_name = 'ဒီးမောဆိုမြို့နယ်' WHERE constituency_name = 'ဒီးမော့ဆိုမြို့နယ်';
UPDATE entries SET constituency_name = 'ဒီးမောဆိုမြို့နယ်၊ ပြည်သူ့လွတ်တော်' WHERE constituency_name = 'ဒီးမော့ဆိုမြို့နယ်၊ ပြည်သူ့လွတ်တော်';
UPDATE entries SET constituency_name = 'ပြည်သူ့လွှတ်တော်၊ဒီးမောဆိုမြို့နယ်မဲဆန္ဒနယ်' WHERE constituency_name = 'ပြည်သူ့လွှတ်တော်၊ဒီးမော့ဆိုမြို့နယ်မဲဆန္ဒနယ်';
UPDATE entries SET constituency_name = 'ပြည်နယ်လွှတ်တော်မဲဆန္ဒနယ်၊ဒီးမောဆိုမြို့နယ်' WHERE constituency_name = 'ပြည်နယ်လွှတ်တော်မဲဆန္ဒနယ်၊ဒီးမော့ဆိုမြို့နယ်';
UPDATE entries SET constituency_name = 'ဒီးမောဆိုမြို့နယ်၊ကယားပြည်နယ်' WHERE constituency_name = 'ဒီးမော့ဆိုမြို့နယ်၊ကယားပြည်နယ်';
UPDATE entries SET constituency_name = 'ပြည်သူ့လွှတ်တော်မဲဆန္ဒနယ်မြေ၊ဒီးမောဆိုမြို့နယ်' WHERE constituency_name = 'ပြည်သူ့လွှတ်တော်မဲဆန္ဒနယ်မြေ၊ဒီးမော့ဆိုမြို့နယ်';
UPDATE entries SET constituency_name = 'ကယားပြည်နယ်၊ ဒီးမောဆိုမြို့နယ်' WHERE constituency_name = 'ကယားပြည်နယ်၊ ဒီးမော့ဆိုမြို့နယ်';


UPDATE consensus_forms SET constituency_name = 'ဒီးမောဆိုမြို့နယ်' WHERE constituency_name = 'ဒီးမော့ဆိုမြို့နယ်';
UPDATE consensus_forms SET constituency_name = 'ဒီးမောဆိုမြို့နယ်၊ ပြည်သူ့လွတ်တော်' WHERE constituency_name = 'ဒီးမော့ဆိုမြို့နယ်၊ ပြည်သူ့လွတ်တော်';
UPDATE consensus_forms SET constituency_name = 'ပြည်သူ့လွှတ်တော်၊ဒီးမောဆိုမြို့နယ်မဲဆန္ဒနယ်' WHERE constituency_name = 'ပြည်သူ့လွှတ်တော်၊ဒီးမော့ဆိုမြို့နယ်မဲဆန္ဒနယ်';
UPDATE consensus_forms SET constituency_name = 'ပြည်နယ်လွှတ်တော်မဲဆန္ဒနယ်၊ဒီးမောဆိုမြို့နယ်' WHERE constituency_name = 'ပြည်နယ်လွှတ်တော်မဲဆန္ဒနယ်၊ဒီးမော့ဆိုမြို့နယ်';
UPDATE consensus_forms SET constituency_name = 'ဒီးမောဆိုမြို့နယ်၊ကယားပြည်နယ်' WHERE constituency_name = 'ဒီးမော့ဆိုမြို့နယ်၊ကယားပြည်နယ်';
UPDATE consensus_forms SET constituency_name = 'ပြည်သူ့လွှတ်တော်မဲဆန္ဒနယ်မြေ၊ဒီးမောဆိုမြို့နယ်' WHERE constituency_name = 'ပြည်သူ့လွှတ်တော်မဲဆန္ဒနယ်မြေ၊ဒီးမော့ဆိုမြို့နယ်';
UPDATE consensus_forms SET constituency_name = 'ကယားပြည်နယ်၊ ဒီးမောဆိုမြို့နယ်' WHERE constituency_name = 'ကယားပြည်နယ်၊ ဒီးမော့ဆိုမြို့နယ်';

ALTER TABLE entries ADD COLUMN gender TEXT DEFAULT '';
ALTER TABLE consensus_forms ADD COLUMN gender TEXT DEFAULT '';
UPDATE entries SET gender = 'M' WHERE SUBSTR(full_name, 0, 3) = 'ဦး';
UPDATE entries SET gender = 'F' WHERE SUBSTR(full_name, 0, 5) = 'ဒေါ်';

UPDATE consensus_forms SET gender = 'M' WHERE SUBSTR(REPLACE(REPLACE(full_name, 'ဒေါက်တာ', ''), ' ', ''), 0, 3) = 'ဦး';
UPDATE consensus_forms SET gender = 'F' WHERE SUBSTR(REPLACE(REPLACE(full_name, 'ဒေါက်တာ', ''), ' ', ''), 0, 5) = 'ဒေါ်';
