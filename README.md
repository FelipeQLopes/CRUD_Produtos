Relatório do Trabalho Prático — CRUD de Produtos
Integrantes do Grupo:

- Davi Manoel
- Felipe Costa
- Felipe Quites
- Nayron Campos


Descrição Resumida do Sistema:

O trabalho consiste em uma página web interativa que implementa um CRUD completo de produtos, utilizando somente HTML, CSS e JavaScript.

Cada produto possui:

ID, Nome, GTIN, Descrição, Ícone e Lápide (exclusão lógica).

Os dados são armazenados e lidos a partir de um arquivo binário, onde cada registro segue a estrutura:

[ID] [Lápide] [Tamanho] [Nome] [GTIN] [Descrição] [Ícone]

Os campos de texto usam o formato:

- [tamanho][dados]

Funcionalidades:
* Criar produtos via formulário
* Listar todos os produtos
* Editar um produto existente
* Excluir através de lápide (não remove fisicamente)
* Visualização do registro em HEX para inspeção

Classes Criadas:

* Produto
Representa um produto e contém métodos para codificar e decodificar o registro binário.

* FileDB
Cuida do arquivo binário, leitura, escrita, atualização e exclusão lógica.

* UIController
Gerencia a interface web: tabela, formulários e interação com o usuário.

Operações Especiais:

- Estrutura binária com campos de tamanho variável
- Lápide para exclusão lógica
- Cálculo do tamanho real de cada registro
- Exibição completa dos bytes em formato HEX

Checklist:

[x] A página web com a visualização interativa do CRUD de produtos foi criada?
Sim.

[x] Há um vídeo de até 3 minutos demonstrando o uso da visualização?
Sim.

[x] O trabalho foi criado apenas com HTML, CSS e JS?
Sim.

[ ] O relatório do trabalho foi entregue no APC?
Não.

[x] O trabalho está completo e funcionando sem erros de execução?
Sim.

[x] O trabalho é original e não a cópia de outro grupo?
Sim.
